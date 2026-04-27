# 常見卡住情境與排除

> Resource URI: `debugmcp://docs/operations/troubleshooting`
> 入口：`debugmcp://docs/operations`　基礎概念：`debugmcp://docs/operations/lifecycle-states`

## A. `start_debugging` 卡到 timeout

**症狀**：呼叫後等 ~180 秒（`debugmcp.timeoutInSeconds` 預設）才返回，訊息類似 `failed to become active within timeout period`。

**檢查**：
1. 確認 VS Code 對應語言的 debug extension 已安裝（Python / Node / Java / .NET / C++）。
2. 看 VS Code Debug Console 是否有錯誤（adapter spawn 失敗、port 被佔用…）。
3. `launch.json` 的 `program`、`cwd`、`env` 是否正確。

**注意**：`fix/lifecycle` 修正後，long-running process 不再因「永遠不 paused」卡住；只剩真實的 attach 失敗才會走到 timeout。如果已升級到此分支仍卡住，多半是上述環境問題。

## B. `start_debugging` 後未 paused

**症狀**：返回 state 只有 `sessionActive: true`，沒有 `fileFullPath` / `currentLine`。

**判斷情境**：
- **是 long-running process** → 這就是預期行為，請參考 `debugmcp://docs/operations/workflow-long-running`，下一步用 `wait_for_pause`。
- **是 CLI / 一般程式** → breakpoint 沒被打到。常見原因：
  - breakpoint 設在沒被執行到的分支。
  - breakpoint 設在註解或函式簽名行（VS Code 會丟棄）。
  - 程式從另一個 entry 跑、根本不過你設的檔案。
  - `lineContent` 字串有空白／編碼差異而沒匹配。

**排除**：
1. `list_breakpoints` 確認 breakpoint 真的被建立。
2. 把 breakpoint 往上游放（main / 入口函式）驗證 entry 對不對。
3. 若程式已跑完 → `get_debug_state` 看 `sessionActive` 是否變 false。

## C. step / variables 收到 `Debug session is not ready`

**症狀**：呼叫 `step_over` / `get_variables_values` / `evaluate_expression` 立即拋例外。

**根因**：session 是 attached 但未 paused。這些 tool 必須 paused 才能執行。

**排除**：
1. `get_debug_state` 確認狀態。
2. 若是 long-running 場景 → 先 `wait_for_pause` 或觸發外部事件。
3. 若是一般場景 → 你的 breakpoint 沒設好（見 B 節）。

## D. `wait_for_pause` 拿到 WARNING timeout

**症狀**：10 秒後回傳開頭 `WARNING: wait_for_pause timed out...`，後接最新 state。

**逐項檢查**（依成本由低到高）：
1. **session 還活著嗎？** `get_debug_state`。`sessionActive=false` 代表程式結束，無從等。
2. **breakpoint 還在嗎？** `list_breakpoints`。restart 過的話有時會丟。
3. **外部事件有確實送到嗎？** 檢查 HTTP client 回應碼、queue 投遞結果。
4. **breakpoint 在會被走到的程式路徑上？** 暫時把它移到更上游（middleware / entry handler）驗證 routing。
5. **是否真的需要等 paused？** 若只是想觀察，多次 `get_debug_state` 比 `wait_for_pause` 更靈活。
6. **重試**：事件可能比預期晚，再呼叫一次 `wait_for_pause`。

## E. `stop_debugging` 沒反應 / 卡住

**已知修正**：commit `5c6560d` 修掉了「未 paused 的 long-running session 被誤判為無 session」。如果仍碰到問題：

1. 確認你跑在 `fix/lifecycle`（或之後的版本）。
2. VS Code Debug Console 是否仍有 spawn 中的子程式。
3. 手動在 VS Code UI 點 stop 是否能結束。若不行，多半是 debug adapter 本身的 bug。

## F. `restart_debugging` 拋 `No active debug session to restart`

**已知修正**：commit `7149ff9`。同樣請確認分支版本。修正後只要 `isAttached()` 為 true 就允許 restart。

## G. `add_breakpoint` 一次設了一堆

**症狀**：呼叫一次回傳 `Breakpoints added at N locations`。

**根因**：`lineContent` 太短或在檔內重複。

**排除**：
- 用更具識別性的片段（變數名 + 操作 + 部份字面值）。
- 真要精準時，先在 IDE 看一眼，挑只出現一次的字串。

## H. `get_variables_values` 回 `No active stack frame`

**根因**：雖然 `hasActiveSession()` 通過了，但 `vscode.debug.activeStackItem` 此刻沒有 `frameId`（例如剛 step 完，VS Code 還沒更新 active item）。

**排除**：
- 短暫等待後重試。
- 確認你最近的 step / continue 回傳的 state 真的有 frame。

## I. 看到「`hasActiveSession` 卻說沒 active」

不是矛盾——`hasActiveSession()` 的真正語意是「具備 location info 的 paused session」。詳見 `debugmcp://docs/operations/lifecycle-states`。如果想單純檢查 lifecycle，請改呼叫 `get_debug_state` 看 `sessionActive`。
