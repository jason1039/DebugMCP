# Long-Running Process Debug 流程

> Resource URI: `debugmcp://docs/operations/workflow-long-running`
> 入口：`debugmcp://docs/operations`　工具細節：`debugmcp://docs/operations/tool-reference`　基礎概念：`debugmcp://docs/operations/lifecycle-states`

適用情境：**程式啟動後不會自己停下來**，而是等待外部事件（HTTP 請求、queue message、scheduler tick）才命中 breakpoint。代表：API server、worker、message consumer、watcher。

> 一般 bug 修復 / 單元測試請改走 `debugmcp://docs/operations/workflow-standard`。

## 為什麼不能用標準流程

`fix/lifecycle` 之前，`start_debugging` 等待「paused 在某 frame」當作 readiness。對於 API server 來說，啟動後 attached 但永遠不會 paused，於是會一路等到 `timeoutInSeconds`（預設 180 秒）才返回，且回傳的 state 也沒 location info。

修正後 `start_debugging` 改為等到 **attached** 即返回，因此 agent 必須自己決定何時等 paused。

## 推薦步驟

```
1. add_breakpoint（在會被外部事件觸發的處理函式內）
2. start_debugging        ← 立即返回 attached 狀態（無 location）
3. 觸發外部事件             ← 由 agent 用其他工具發送 HTTP 請求 / 投遞 message
4. wait_for_pause          ← 阻塞最多 10 秒，等 breakpoint 命中
5. 命中 → 探索（step / variables / evaluate）
6. 沒中 → 看回傳 WARNING，決定重試或先 get_debug_state 確認
7. 找到 root cause → clear_all_breakpoints → stop_debugging
```

## 完整時序

### Step 1：在處理函式內設 breakpoint

```jsonc
add_breakpoint({
  fileFullPath: "C:/proj/src/handlers/orders.ts",
  lineContent: "const order = await OrderService.create("
})
```

不要設在 `app.listen(...)` 或 framework bootstrap 那一段——那裡只會在啟動時跑一次，不是你想觀察的事件。

### Step 2：start_debugging

回傳預期：

```jsonc
"Debug session started successfully for: ... Current state: { \"sessionActive\": true }"
//                                                                  ^^^^^^^^^^^^^^^^^^^^
// 沒有 fileFullPath/currentLine 是正常的：server 還沒收到請求
```

如果回傳裡有 location info，代表你的 breakpoint 在啟動路徑上就被打到——這已經是一般場景，可改走標準流程。

### Step 3：觸發外部事件

由 agent 自行用其他工具（如 curl、`fetch`、訊息佇列 SDK）發出請求。例：

```
curl -X POST http://localhost:8080/orders -d '{"sku":"A1","qty":2}'
```

### Step 4：wait_for_pause

```jsonc
wait_for_pause()
```

四種可能結果：

| 結果 | 回傳 | 下一步 |
| --- | --- | --- |
| 命中 breakpoint | `DebugState` JSON 含 `fileFullPath` / `currentLine` | 進入探索（Step 5） |
| session 結束 | `{ "sessionActive": false }` | 程式可能 crash 或自然結束，看 stack trace / 重新規劃 |
| 10 秒 timeout | `WARNING: wait_for_pause timed out... \n {state}` | 看 troubleshooting |
| 從未 attach | 拋 `No active debug session` | 先 `start_debugging` |

### Step 5：探索（與標準流程相同）

step / variables / evaluate 都需要 paused，這時才合法。

### Step 6：timeout 的決策

收到 WARNING 時的處置順序：

1. **確認 session 仍活著**：`get_debug_state`。`sessionActive=false` 表示 process 已結束，無從探索。
2. **確認外部事件確實送出**：檢查 client 端 log / response code。
3. **確認 breakpoint 設在會走到的路徑**：`list_breakpoints` 比對；可暫時換成更上游的位置（如 middleware）驗證。
4. **再試一次 `wait_for_pause`**：事件可能比預期晚到。
5. **改用 polling**：對於不確定何時會發生的事件，用 `get_debug_state` 自行排程多次查詢，比固定 10 秒等待靈活。

## `wait_for_pause` vs `get_debug_state` 怎麼選

| 場景 | 選用 | 理由 |
| --- | --- | --- |
| 剛觸發事件，預期 1–10 秒內會中 breakpoint | `wait_for_pause` | 阻塞輪詢省事 |
| 不確定事件何時來、要持續監看 | 多次 `get_debug_state` | 不被 10 秒上限綁住 |
| 想先確認 session 還活著再決定下一步 | `get_debug_state` | 不阻塞 |
| 寫互動腳本、需要立即反應 | `get_debug_state` | 立即返回 |

## 反模式

| ❌ | ✅ |
| --- | --- |
| 對 API server `start_debugging` 後立刻 `step_over` | 必須先 `wait_for_pause` 等 paused，否則會收到 `Debug session is not ready` |
| 連續呼叫 `wait_for_pause` 直到中為止（無限迴圈） | 收到 WARNING 後檢查 session、breakpoint、事件三件事，再決定重試 |
| 預設 breakpoint 命中時才有事可做 | 用 `get_debug_state` 確認 lifecycle，避免誤判 |
| breakpoint 設在 `app.listen` | 設在實際處理請求/事件的 handler 內 |
