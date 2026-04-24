# DebugMCP 專案解析附註

## 專案定位

DebugMCP 是一個 VS Code extension，啟動後會在本機開出 MCP server，讓支援 MCP 的 AI coding agent 透過 HTTP 呼叫 VS Code Debug API。它的核心價值不是取代 debugger，而是把 debugger 操作包成 AI 可以穩定呼叫的工具：啟動偵錯、設定中斷點、逐步執行、讀取變數、評估 expression，以及取得目前停在哪個檔案與哪一行。

目前執行模型可以簡化成：

```text
AI Agent
  -> MCP HTTP POST /mcp
  -> DebugMCPServer
  -> DebuggingHandler
  -> DebuggingExecutor
  -> VS Code Debug API / DAP customRequest
```

Extension activation 由 `src/extension.ts` 的 `activate()` 負責。它會讀取 `debugmcp.serverPort` 與 `debugmcp.timeoutInSeconds`，建立 `AgentConfigurationManager`，嘗試遷移舊的 agent MCP 設定，接著初始化並啟動 `DebugMCPServer`。伺服器成功啟動後，AI agent 主要使用 `http://localhost:{port}/mcp` 呼叫工具。

## 核心模組導讀

`DebugMCPServer` 是外部入口。它包裝官方 `@modelcontextprotocol/sdk` 的 `McpServer`，註冊 MCP tools 與 documentation resources，並用 express 提供 HTTP endpoint。它不直接碰 VS Code debugger，而是把每個 tool callback 委派給 `DebuggingHandler`。

`DebuggingHandler` 是 orchestration layer。它負責把 MCP tool 的參數轉成偵錯操作、等待非同步 debugger 狀態改變，並把結果整理成 AI agent 容易理解的文字或 JSON state。對 step/continue 這類操作，它會先擷取 before state，執行命令，再用輪詢等待 meaningful state change。

`DebuggingExecutor` 是 VS Code Debug API adapter。它實際呼叫 `vscode.debug.startDebugging()`、`vscode.commands.executeCommand()`、`vscode.debug.addBreakpoints()`，並透過 DAP `customRequest()` 讀 stack trace、scopes、variables 與 evaluate 結果。這一層盡量保持低階，專注於「如何操作 VS Code」。

`DebugState` 是偵錯狀態快照。它記錄 session 是否 active、目前檔案與行號、frame/thread id、stack trace、configuration name 與 breakpoints。`toString()` 會輸出 compact JSON，作為多數 tool 回應的一部分。

`DebugConfigurationManager` 負責決定啟動 debug session 時要用哪個 configuration。它會優先讀取 workspace `.vscode/launch.json` 中指定名稱的設定；若沒有符合項目，就依檔案副檔名產生預設 configuration。它也支援針對 Python、Node、Java、.NET 等測試情境產生 test-specific config。

`AgentConfigurationManager` 負責把 DebugMCP server 寫入 AI agent 的 MCP 設定檔。目前支援 Cline、GitHub Copilot 與 Cursor。它會依作業系統推導設定目錄，寫入 `streamableHttp` endpoint，並在 activation 時嘗試把舊的 `/sse` 或 `http` 設定遷移到新的 `/mcp` 形式。

`Logger` 是 extension 內部 logging wrapper，輸出到 VS Code `LogOutputChannel`。AGENTS.md 要求新程式碼使用這個 logger，而不是直接使用 `console.*`。

## MCP Tools 與責任邊界

| Tool | Server 責任 | Handler/Executor 責任 |
| --- | --- | --- |
| `get_debug_instructions` | 讀取 markdown resource 並回傳文字 | 無 debugger 操作 |
| `start_debugging` | 驗證 schema 並委派 | 選 config、啟動 session、等待 session ready |
| `stop_debugging` | 委派 | 停止 active session，回傳 root-cause checkpoint |
| `step_over` / `step_into` / `step_out` | 委派 | 執行 VS Code command，等待狀態改變 |
| `continue_execution` | 委派 | resume execution，等待下一個停點或 session 結束 |
| `restart_debugging` | 委派 | 呼叫 restart command，等待短暫 debugger 更新 |
| `add_breakpoint` | 驗證 schema 並委派 | 用 `lineContent` 找所有匹配行並新增 breakpoints |
| `remove_breakpoint` | 驗證 schema 並委派 | 找到指定 file/line 的 breakpoint 後移除 |
| `clear_all_breakpoints` | 委派 | 移除所有 VS Code breakpoints |
| `list_breakpoints` | 委派 | 格式化目前 breakpoint 清單 |
| `get_variables_values` | 驗證 scope schema 並委派 | 透過 DAP scopes/variables 取得變數 |
| `evaluate_expression` | 驗證 expression schema 並委派 | 透過 DAP evaluate 在目前 frame 評估 expression |

`DebugMCPServer` 的重點是 protocol surface；`DebuggingHandler` 的重點是流程與等待；`DebuggingExecutor` 的重點是 VS Code API 與 DAP 細節。維護時最好保持這三層分工，避免把 protocol、等待策略和 VS Code 低階操作混在同一層。

## 偵錯生命週期

1. AI agent 呼叫 `start_debugging`，提供目標檔案與 working directory。
2. `DebuggingHandler` 向 `DebugConfigurationManager` 取得 configuration。若沒有指定 configuration，會跳出 QuickPick 讓使用者選擇既有 launch config 或 default config。
3. `DebuggingExecutor` 呼叫 VS Code debug API 啟動 session。`.NET` 的 `coreclr` 有特殊流程，會開啟指定檔案並執行 `testing.debugCurrentFile`。
4. Handler 使用 exponential backoff 等待 active debug session ready。這裡的 ready 不只是 session 存在，還要能取得 location info。
5. session active 後，Executor 擷取 `DebugState`，包含目前檔案、行號、stack trace、breakpoints 與 frame/thread context。
6. 後續 step/continue/evaluate/variables 操作都依賴目前 active stack frame 或 active editor 狀態。
7. `stop_debugging` 停止 session，並回傳 root-cause analysis checkpoint，提醒 agent 不要只停在症狀層級。

## 資料流重點

Breakpoint 新增採用 `lineContent` 而不是直接傳 line number。Handler 會開啟檔案、搜尋包含該字串的所有行，然後對每個匹配位置建立 breakpoint。這讓 AI agent 可以用它看到的程式碼片段設定中斷點，但若同一段文字重複出現，就會一次設定多個 breakpoint。

Step/continue 會回傳 `DebugState.toString()`。這個 JSON 是 AI agent 判斷下一步的重要依據，包含目前行、下一些非空白行、frame name、stack trace 與 breakpoints。`hasStateChanged()` 定義了什麼叫 meaningful change：session 狀態、檔案、行號、frame name 或 frame id 改變。

Variables 與 expression evaluation 都需要 active stack frame。Handler 先檢查 `vscode.debug.activeStackItem` 是否存在並帶有 `frameId`，Executor 再用 active debug session 發送 DAP `scopes`、`variables` 或 `evaluate` request。

## 設定產生與 agent 自動設定

`DebugConfigurationManager` 先嘗試讀 `.vscode/launch.json`。若使用者指定 `configurationName` 且有匹配設定，會回傳該設定並改名為 `DebugMCP Launch (...)`。如果沒有匹配設定或讀取失敗，會依副檔名 fallback 到預設 config。

語言偵測目前主要依副檔名，例如 `.py` 對應 `python`、`.ts`/`.js` 對應 `node`、`.cs` 對應 `coreclr`。未知副檔名 fallback 到 Python。測試模式下，Python 會嘗試組出 unittest target，Node 會依檔名猜 Jest 或 Mocha，Java 與 .NET 也有各自的 test config。

`AgentConfigurationManager` 會在不同 OS 下推導 agent config path，並把 DebugMCP 寫成：

```json
{
  "type": "streamableHttp",
  "url": "http://localhost:3001/mcp"
}
```

不同 agent 的 MCP server collection 欄位名稱不同：Cline 與 Cursor 使用 `mcpServers`，GitHub Copilot 使用 `servers`。

## 維護觀察

以下是閱讀程式時值得注意的現況，不屬於本次文件與 JSDoc 補註的修改範圍：

- README 與架構文件大多描述新的 `/mcp` endpoint，但部分舊文字或註解仍提到 SSE，需要未來集中整理。
- 部分 source file 仍使用 `console.*`，而 AGENTS.md 建議使用 `logger`。
- 部分 DAP response 與 JSON config parsing 使用 `any`，若未來要提升型別安全，可以先從小型 response interface 開始。
- `DebugMCPServer` 保留 `transports` map，但目前 streamable HTTP 採 stateless per-request transport，實際上不需要追蹤長生命週期 transport。
- `DebuggingHandler.handleStepOver()` 接受 `steps` 參數型別，但目前 tool schema 沒有暴露此參數，方法內也沒有使用它。

這些觀察可作為後續重構或 issue triage 的起點；本文件只記錄目前行為，避免和本次純文件補註混在一起。
