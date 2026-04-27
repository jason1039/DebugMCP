# Session Lifecycle 與 Paused 狀態

> Resource URI: `debugmcp://docs/operations/lifecycle-states`
> 入口：`debugmcp://docs/operations`（地圖）

DebugMCP 內部把 debug session 的「生命週期」與「目前是否停在某個 frame 上」當成兩件獨立的事。混淆這兩件事是過去多個 bug 的共同根因。

## 三種狀態

| 狀態 | 條件 | 可以做什麼 |
| --- | --- | --- |
| **detached** | `vscode.debug.activeDebugSession === undefined` | 只能 `start_debugging`、操作 breakpoint |
| **attached（執行中，尚未 paused）** | session 存在，但 `vscode.debug.activeStackItem` 沒有 `frameId` | 可 `stop_debugging`、`restart_debugging`、`get_debug_state`、`wait_for_pause` |
| **paused（停在某個 frame）** | session 存在 **且** 有 `activeStackItem.frameId` | 上述全部，加 step / continue / variables / evaluate |

## 兩個判斷函式

[`src/debuggingExecutor.ts`](../../../src/debuggingExecutor.ts) 對應這個模型暴露兩個 API：

| 函式 | 判斷邏輯 | 對應狀態 |
| --- | --- | --- |
| `isAttached()` | `vscode.debug.activeDebugSession !== undefined` | attached 或 paused |
| `hasActiveSession()` | `activeDebugSession` 存在 **且** 取得到 location info（檔案 + 行號） | 只有 paused |

> ⚠️ 命名陷阱：`hasActiveSession()` 名稱看起來像 lifecycle 檢查，實際上是 paused 檢查。維護時請優先看實際呼叫端的語意。

## handler 層的選用規則

| 操作 | 應用 | 原因 |
| --- | --- | --- |
| `start_debugging` 等待就緒 | `isAttached()` | 程式可能是 long-running，不會自己停下來 |
| `stop_debugging` 前置檢查 | `isAttached()` | 即使尚未 paused，也應該能停止 |
| `restart_debugging` 前置檢查 | `isAttached()` | restart 是 lifecycle 操作 |
| `step_*` / `continue_execution` 前置檢查 | `hasActiveSession()` | 必須有 frame 才有意義 |
| `get_variables_values` / `evaluate_expression` 前置檢查 | `hasActiveSession()` | DAP 需要 frameId |
| `get_debug_state` | 不檢查 | 永遠回傳當下狀態 |
| `wait_for_pause` 前置檢查 | `isAttached()` | 等待 paused 出現是其工作 |

## 過去的踩坑紀錄

| Commit | 症狀 | 根因 |
| --- | --- | --- |
| [ff8fbfe](#) | 啟動 API server 卡到 timeout（180 秒）才返回 | `waitForActiveDebugSession` 用 `hasActiveSession`，等永遠不會 paused 的 session |
| [5c6560d](#) | `stop_debugging` 對 long-running session 卡住或誤判為「無 session」 | 用 `hasActiveSession` 當 lifecycle 檢查 |
| [7149ff9](#) | `restart_debugging` 對未 paused 的 session 回「No active debug session to restart」 | 同上 |

修正策略一致：**只要是 lifecycle 操作，就用 `isAttached()`；只要需要 frame，才用 `hasActiveSession()`**。

## 給 agent 的判斷流程

收到任一 tool 回應後，先看 `DebugState` JSON：

```jsonc
{
  "sessionActive": true,        // → isAttached() 為 true
  "fileFullPath": "...",        // ← 有這欄就是 paused
  "currentLine": 42,            // ← 有這欄就是 paused
  "frameId": 1000               // ← 有這欄就是 paused
}
```

- `sessionActive = false` → detached，只能重新開始。
- `sessionActive = true` 但缺 location info → attached 但未 paused，**禁止呼叫 step / variables / evaluate**，改用 `wait_for_pause` 或 `get_debug_state`。
- 三者俱全 → paused，全部工具皆可用。

更多工具個別細節見 `debugmcp://docs/operations/tool-reference`。
