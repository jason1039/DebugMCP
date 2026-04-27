# 標準 Debug 流程

> Resource URI: `debugmcp://docs/operations/workflow-standard`
> 入口：`debugmcp://docs/operations`　工具細節：`debugmcp://docs/operations/tool-reference`

適用情境：**程式啟動後會在某個位置停下來**（命中 breakpoint、executable 進到測試、或 entrypoint 立即觸發目標邏輯）。最常見：bug 修復、單元測試、CLI 程式。

如果是 API server / worker / 訂閱者這類「啟動後等外部事件」的程式，請改走 `debugmcp://docs/operations/workflow-long-running`。

## 推薦步驟

```
0. get_debug_instructions（首次或不確定時）
1. add_breakpoint（至少一個起點）
2. start_debugging
   ↓ 立即返回 paused state（因為起點就是 breakpoint）
3. 觀察 → step_* / continue_execution / get_variables_values / evaluate_expression
4. 找到 root cause（不只是 symptom）
5. clear_all_breakpoints
6. stop_debugging
```

## 詳細範本

### Step 1：設定起點 breakpoint

用 `add_breakpoint` 搭配 `lineContent`（程式碼片段，不是行號）。注意：
- 避開 function 簽名與註解行。
- 避開重複度高的字串（會一次設下多個）。
- 多個策略點可以分次呼叫。

```jsonc
add_breakpoint({
  fileFullPath: "C:/proj/src/order.ts",
  lineContent: "const total = items.reduce("
})
```

### Step 2：start_debugging

```jsonc
start_debugging({
  fileFullPath: "C:/proj/src/order.ts",
  workingDirectory: "C:/proj"
  // configurationName 留空 → 使用者會被提示選擇
  // testName 僅在 debug 單一測試時提供
})
```

回傳會包含 `Current state: { ... }`。**檢查這個 state**：
- `sessionActive: true` 且有 `fileFullPath`、`currentLine` → 已停在第一個 breakpoint，可以繼續。
- 只有 `sessionActive: true` 沒有 location → 程式跑過去了（你的 breakpoint 可能設在不會執行的位置），請參考 [troubleshooting.md](troubleshooting.md#startdebug-後未-paused)。

### Step 3：探索

每一個 step / continue 後 **務必檢查回傳的 `DebugState` JSON**：

| 你想知道 | 看哪欄 |
| --- | --- |
| 是否還在同一個函式 | `frameName` |
| 是否還在執行 | `sessionActive` |
| 即將執行的下一行 | `currentLine` + `nextLines` |
| 整個呼叫鏈 | `stackTrace` |

問題不明時的順序：
1. `get_variables_values({ scope: "local" })` 看當前 scope。
2. `evaluate_expression` 驗證假設（「`user.id` 此刻是什麼？」）。
3. 仍不夠就 `step_into` 進入可疑函式。

### Step 4：root cause

`debugmcp://docs/debug_instructions` 的 **「NEVER STOP AT SYMPTOMS」** 框架。簡短版檢查：

- [ ] 我能否解釋從 root cause 到 symptom 的完整鏈？
- [ ] 修這個位置能否從根本阻止 symptom？
- [ ] 是否還能再往上問一個「為什麼」？

若還能再問，就 `add_breakpoint` 到上游、`restart_debugging` 重新追蹤。

### Step 5–6：收尾

```
clear_all_breakpoints
stop_debugging        ← 回傳會帶 root cause checkpoint 提醒，再確認一次
```

## 反模式

| ❌ 反模式 | ✅ 正解 |
| --- | --- |
| 不設 breakpoint 直接 `start_debugging` | 至少設一個起點，否則普通程式會直接跑完 |
| breakpoint 設在 `def foo():` / `function foo() {` | 設在函式體內第一行可執行語句 |
| step over 經過可疑行就繼續 | 停下來、設 breakpoint 在該行、`restart_debugging` 重來 |
| 看到 null 就下結論 | 往上追為什麼是 null（initialization、傳參、外部來源） |
| 結束前留著一堆 breakpoint | 用 `clear_all_breakpoints` 收尾 |
