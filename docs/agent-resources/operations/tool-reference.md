# MCP Tool 速查

> Resource URI: `debugmcp://docs/operations/tool-reference`
> 入口：`debugmcp://docs/operations`　相關概念：`debugmcp://docs/operations/lifecycle-states`

依用途分組，每組附「前置條件」「典型輸出」「容易誤用」。所有 tool 註冊在 [`src/debugMCPServer.ts`](../../../src/debugMCPServer.ts) `setupTools()`。

## A. 文件 / 啟動

### `get_debug_instructions`
- **前置條件**：無。
- **輸出**：`debug_instructions.md` 完整內容（含 root cause analysis framework）。
- **何時用**：第一次接觸專案、或 client 不支援 MCP resources（如 GitHub Copilot）時。

### `start_debugging`
- **參數**：`fileFullPath`、`workingDirectory`、`testName?`、`configurationName?`。
- **前置條件**：建議先設好至少一個 breakpoint（long-running 場景除外）。
- **行為**：解析 launch config → 啟動 session → 等到 **attached**（不等 paused）→ 回傳 `DebugState`。
- **輸出**：`Debug session started successfully for: ... Current state: { ... }`
- **誤用**：對 long-running process（如 API server）期望它「啟動完就 paused」。實際上 attached 後 sessionActive=true 但無 location info，需後續 `wait_for_pause`。

## B. Lifecycle 控制

### `stop_debugging`
- **前置條件**：`isAttached()`（不要求 paused）。
- **輸出**：成功訊息 + root cause analysis checkpoint 提醒。
- **誤用**：以為「沒看到斷點停下來就無法 stop」。已修正為 lifecycle-only 檢查。

### `restart_debugging`
- **前置條件**：`isAttached()`。
- **輸出**：`Debug session restarted successfully`。
- **注意**：僅做 restart command + 短暫 delay（300ms），不會等到下一個 paused。需等 paused 請接 `wait_for_pause`。

## C. 步進 / 繼續（**必須 paused**）

### `step_over` / `step_into` / `step_out` / `continue_execution`
- **前置條件**：`hasActiveSession()`，必須已 paused 在某 frame。
- **行為**：擷取 before state → 執行 VS Code command → 輪詢直到 `hasStateChanged()` 為 true（檔案/行/frame 任一改變）或 timeout。
- **輸出**：`DebugState` JSON。
- **誤用**：對未 paused 的 session 呼叫 → 立即拋 `Debug session is not ready`。

## D. 狀態查詢（lifecycle 感知）

### `get_debug_state` 🆕
- **前置條件**：無。
- **行為**：立即回傳當下 `DebugState`，不阻塞、不等待。
- **典型輸出**：
  - 無 session：`{ "sessionActive": false }`
  - 執行中未 paused：`{ "sessionActive": true }`（無 location 欄位）
  - 已 paused：`{ "sessionActive": true, "fileFullPath": "...", "currentLine": 42, ... }`
- **何時用**：long-running process 啟動後輪詢；或單純確認當前狀態，不想阻塞。

### `wait_for_pause` 🆕
- **前置條件**：`isAttached()`。
- **行為**：以 exponential backoff（500ms → 2s）輪詢 `getCurrentDebugState`，直到下列其一：
  1. 出現 location info → 視為 paused，回傳 state。
  2. session 已結束 → 立即回傳。
  3. 超過 **10 秒硬上限** → 回傳最新 state，前綴 `WARNING: ...`。
- **何時用**：啟動 long-running process 並觸發外部事件（HTTP 請求、queue message）後，預期 breakpoint 會被打到。
- **誤用**：在沒有任何外部事件會觸發 breakpoint 時呼叫 → 必然 timeout。

## E. Breakpoint 管理

### `add_breakpoint`
- **參數**：`fileFullPath`、`lineContent`（程式碼片段，不是行號）。
- **行為**：開檔搜尋包含該文字的所有行，**每一個 match 都加一個 breakpoint**。
- **誤用**：用很短或重複出現的字串（如 `return`）→ 一次設下多個 breakpoint。

### `remove_breakpoint`
- **參數**：`fileFullPath`、`line`（1-based）。
- **行為**：找該位置 SourceBreakpoint 並移除；找不到則回傳 `No breakpoint found at ...`，不會拋例外。

### `clear_all_breakpoints`
- **行為**：移除全部。建議在「root cause 已找到並驗證」後呼叫。

### `list_breakpoints`
- **輸出**：human-readable 清單。

## F. 變數 / 表達式（**必須 paused**）

### `get_variables_values`
- **參數**：`scope?: 'local' | 'global' | 'all'`，預設 `all`。
- **前置條件**：`hasActiveSession()` + `vscode.debug.activeStackItem` 有 `frameId`。
- **行為**：DAP `scopes` → `variables`，依 scope 過濾。

### `evaluate_expression`
- **參數**：`expression`。
- **前置條件**：同上。
- **行為**：DAP `evaluate` 在當前 frame 執行；非破壞性的快速假設驗證手段。

## 一覽表

| Tool | 是否需 paused | 是否阻塞 |
| --- | :-: | :-: |
| `get_debug_instructions` | ✗ | ✗ |
| `start_debugging` | ✗ | 等到 attached（最多 `timeoutInSeconds`） |
| `stop_debugging` | ✗ | ✗ |
| `restart_debugging` | ✗ | ✗（300ms delay） |
| `step_*` / `continue_execution` | ✓ | 等到 state change（最多 `timeoutInSeconds`） |
| `get_debug_state` | ✗ | ✗ |
| `wait_for_pause` | ✗ | 最多 10 秒硬上限 |
| `add_breakpoint` / `remove_breakpoint` / `clear_all_breakpoints` / `list_breakpoints` | ✗ | ✗ |
| `get_variables_values` / `evaluate_expression` | ✓ | ✗ |

完整流程組合請見 `debugmcp://docs/operations/workflow-standard` 與 `debugmcp://docs/operations/workflow-long-running`。
