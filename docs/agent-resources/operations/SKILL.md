# DebugMCP Operations Skill

> **此文件是入口（entry）。** 它本身不含完整操作細節，而是列出依賴 resource 的 URI；
> agent 讀完入口後，依需求再讀對應的子 resource。
>
> Resource URI（MCP client）：`debugmcp://docs/operations`
> Tool fallback（不支援 resource 的 client）：`get_operations_skill`

## 何時需要這個 skill

- 啟動 long-running process（API server、worker、daemon）後，不知道下一步。
- 呼叫 `start_debugging`、`stop_debugging`、`restart_debugging` 卡住超過預期。
- 想知道 `hasActiveSession` vs `isAttached` 的差異。
- 想知道何時用 `get_debug_state`、何時用 `wait_for_pause`。

如果只是要做一次普通的「設斷點 → 啟動 → step → 看變數」流程，請優先讀 `debugmcp://docs/debug_instructions`（或呼叫 `get_debug_instructions`）。本 skill 是進階補充。

## 依賴 Resource 地圖

| # | 用途 | Resource URI | 何時讀 |
| - | --- | --- | --- |
| 1 | detached / attached / paused 三狀態模型 | `debugmcp://docs/operations/lifecycle-states` | 想理解整個模型，**先讀這個** |
| 2 | 14 個 MCP tool 的責任邊界、阻塞性、典型輸出 | `debugmcp://docs/operations/tool-reference` | 查單一 tool 的行為 |
| 3 | 一般 debug 流程（程式啟動即會 paused） | `debugmcp://docs/operations/workflow-standard` | 處理普通 bug、單元測試 |
| 4 | long-running process 流程（外部事件觸發 breakpoint） | `debugmcp://docs/operations/workflow-long-running` | API server / worker / 訂閱者 |
| 5 | 常見卡住情境與解法 | `debugmcp://docs/operations/troubleshooting` | tool 卡住、timeout、誤判時 |

## 三秒決策樹

```
呼叫 start_debugging 後 ─┐
                        │
       目標程式啟動就會立刻命中 breakpoint？
                        │
              ┌─────────┴──────────┐
             Yes                   No（long-running process）
              │                     │
   讀 #3 standard workflow    讀 #4 long-running workflow
                              │
                  啟動後 → 觸發外部事件 → wait_for_pause
```

## 讀取建議順序

1. **第一次接觸** → 依序讀 #1（模型）→ #2（工具）→ 走決策樹挑 #3 或 #4。
2. **已熟悉模型，要做事** → 直接讀 #3 或 #4。
3. **遇到問題** → 讀 #5，再回 #1 對照狀態定義。

## 維護備忘（給維護者）

- 對應的程式變更：`fix/lifecycle` 分支 commits `ff8fbfe..ffeb547`（5 commits）。
- Resource 註冊位置：[`src/debugMCPServer.ts`](../../../src/debugMCPServer.ts) `setupResources()`。
- 若 `IDebuggingExecutor` 新增 `isAttached()` 以外的 lifecycle 方法，請同步更新 lifecycle-states。
- 若 `setupTools()` 新增/移除工具，請同步更新 tool-reference。
- 檔案系統路徑與 MCP URI 對應表寫在 `setupResources()` 的 `operationsResources` 陣列。
