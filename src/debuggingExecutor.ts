// Copyright (c) Microsoft Corporation.

import * as vscode from 'vscode';
import { DebugState, StackFrame } from './debugState';

/**
 * VS Code debugging operations 的低階 adapter surface。
 *
 * 實作會呼叫 VS Code commands、VS Code debug APIs 與 DAP custom requests。
 * handler layer 依賴此 interface，因此 orchestration logic 可以在沒有真實
 * debug session 的情況下測試。
 */
export interface IDebuggingExecutor {
    /** 使用指定 workspace 與 configuration 啟動 debug session。 */
    startDebugging(workingDirectory: string, config: vscode.DebugConfiguration): Promise<boolean>;
    /** 停止指定 session 或 active session。 */
    stopDebugging(session?: vscode.DebugSession): Promise<void>;
    /** 執行 VS Code 的 step-over command。 */
    stepOver(): Promise<void>;
    /** 執行 VS Code 的 step-into command。 */
    stepInto(): Promise<void>;
    /** 執行 VS Code 的 step-out command。 */
    stepOut(): Promise<void>;
    /** 繼續執行程式。 */
    continue(): Promise<void>;
    /** 重新啟動 active debug session。 */
    restart(): Promise<void>;
    /** 在 1-based 行號新增 source breakpoint。 */
    addBreakpoint(uri: vscode.Uri, line: number): Promise<void>;
    /** 移除 1-based 行號上的 source breakpoints。 */
    removeBreakpoint(uri: vscode.Uri, line: number): Promise<void>;
    /** 擷取目前 debugger state snapshot。 */
    getCurrentDebugState(numNextLines: number): Promise<DebugState>;
    /** 取得指定 frame 的 variables，並可套用 optional scope filter。 */
    getVariables(frameId: number, scope?: 'local' | 'global' | 'all'): Promise<any>;
    /** 在指定 frame 中評估 expression。 */
    evaluateExpression(expression: string, frameId: number): Promise<any>;
    /** 回傳所有 VS Code breakpoints。 */
    getBreakpoints(): readonly vscode.Breakpoint[];
    /** 移除所有 VS Code breakpoints。 */
    clearAllBreakpoints(): void;
    /** 判斷 active session 是否已 ready 可執行 operations。 */
    hasActiveSession(): Promise<boolean>;
    /** 若存在，回傳 VS Code 的 active debug session。 */
    getActiveSession(): vscode.DebugSession | undefined;
}

/**
 * 對 VS Code 與 active debug adapter 執行 debugger operations。
 *
 * 此 class 刻意貼近 VS Code APIs。它不決定 MCP response wording 或 wait-policy
 * semantics；這些仍留在 DebuggingHandler。
 */
export class DebuggingExecutor implements IDebuggingExecutor {

    /**
     * 使用指定 configuration 啟動 debugging session。
     *
     * .NET/coreclr 使用 VS Code 的 test debugging command path，因為此 extension
     * 依賴該 adapter 的 current file test workflow。
     *
     * @param workingDirectory 用來定位 VS Code workspace folder 的 workspace 或 folder path。
     * @param config 傳給 VS Code 的 debug configuration。
     * @returns 當 VS Code 接受 debug session start request 時回傳 true。
     * @throws Error 當 VS Code 拒絕或無法執行 start operation 時丟出。
     */
    public async startDebugging(
        workingDirectory: string, 
        config: vscode.DebugConfiguration
    ): Promise<boolean> {
        try {
            if (config.type === 'coreclr') {
                // 開啟指定 test file，而不是 workspace folder。
                const testFileUri = vscode.Uri.file(config.program);
                await vscode.commands.executeCommand('vscode.open', testFileUri);
                vscode.commands.executeCommand('testing.debugCurrentFile');
                return true;
            }
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(workingDirectory));
            return await vscode.debug.startDebugging(workspaceFolder, config);
        } catch (error) {
            throw new Error(`Failed to start debugging: ${error}`);
        }
    }

    /**
     * 停止 debug session。
     *
     * @param session 要停止的指定 session；預設為 active session。
     * @throws Error 當 VS Code 無法停止 session 時丟出。
     */
    public async stopDebugging(session?: vscode.DebugSession): Promise<void> {
        try {
            const activeSession = session || vscode.debug.activeDebugSession;
            if (activeSession) {
                await vscode.debug.stopDebugging(activeSession);
            }
        } catch (error) {
            throw new Error(`Failed to stop debugging: ${error}`);
        }
    }

    /**
     * 執行 VS Code 的 step-over command。
     *
     * @throws Error 當 command 失敗時丟出。
     */
    public async stepOver(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.action.debug.stepOver');
        } catch (error) {
            throw new Error(`Failed to step over: ${error}`);
        }
    }

    /**
     * 執行 VS Code 的 step-into command。
     *
     * @throws Error 當 command 失敗時丟出。
     */
    public async stepInto(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.action.debug.stepInto');
        } catch (error) {
            throw new Error(`Failed to step into: ${error}`);
        }
    }

    /**
     * 執行 VS Code 的 step-out command。
     *
     * @throws Error 當 command 失敗時丟出。
     */
    public async stepOut(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.action.debug.stepOut');
        } catch (error) {
            throw new Error(`Failed to step out: ${error}`);
        }
    }

    /**
     * 執行 VS Code 的 continue command。
     *
     * @throws Error 當 command 失敗時丟出。
     */
    public async continue(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.action.debug.continue');
        } catch (error) {
            throw new Error(`Failed to continue: ${error}`);
        }
    }

    /**
     * 執行 VS Code 的 restart debug command。
     *
     * @throws Error 當 command 失敗時丟出。
     */
    public async restart(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.action.debug.restart');
        } catch (error) {
            throw new Error(`Failed to restart: ${error}`);
        }
    }

    /**
     * 在 1-based 行號新增 source breakpoint。
     *
     * @param uri breakpoint 所在檔案 URI。
     * @param line 1-based source 行號。
     * @throws Error 當 breakpoint creation 失敗時丟出。
     */
    public async addBreakpoint(uri: vscode.Uri, line: number): Promise<void> {
        try {
            const breakpoint = new vscode.SourceBreakpoint(
                new vscode.Location(uri, new vscode.Position(line - 1, 0))
            );
            vscode.debug.addBreakpoints([breakpoint]);
        } catch (error) {
            throw new Error(`Failed to add breakpoint: ${error}`);
        }
    }

    /**
     * 移除 1-based 行號上的 source breakpoints。
     *
     * @param uri breakpoint 所在檔案 URI。
     * @param line 1-based source 行號。
     * @throws Error 當 breakpoint removal 失敗時丟出。
     */
    public async removeBreakpoint(uri: vscode.Uri, line: number): Promise<void> {
        try {
            const breakpoints = vscode.debug.breakpoints.filter(bp => {
                if (bp instanceof vscode.SourceBreakpoint) {
                    return bp.location.uri.toString() === uri.toString() && 
                           bp.location.range.start.line === line - 1;
                }
                return false;
            });
            
            if (breakpoints.length > 0) {
                vscode.debug.removeBreakpoints(breakpoints);
            }
        } catch (error) {
            throw new Error(`Failed to remove breakpoint: ${error}`);
        }
    }

    /**
     * 將目前 debugger state 擷取為可序列化的 snapshot。
     *
     * 此方法結合 active debug session metadata、active stack item IDs、active
     * editor location、短 source preview、stack trace 與目前 breakpoints。
     *
     * @param numNextLines 要包含的目前行後方非空白行數。
     * @returns DebugState snapshot。若沒有 active session，state 會維持 inactive。
     */
    public async getCurrentDebugState(numNextLines: number = 3): Promise<DebugState> {
        const state = new DebugState();
        
        try {
            const activeSession = vscode.debug.activeDebugSession;
            if (activeSession) {
                state.sessionActive = true;
                state.updateConfigurationName(activeSession.configuration.name ?? null);
                
                const activeStackItem = vscode.debug.activeStackItem;
                if (activeStackItem && 'frameId' in activeStackItem) {
                    state.updateContext(activeStackItem.frameId, activeStackItem.threadId);
                    
                    // 從 stack frame 擷取 frame name。
                    await this.extractFrameName(activeSession, activeStackItem.frameId, state);
                    
                    // 取得 active editor。
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        const fileName = activeEditor.document.fileName.split(/[/\\]/).pop() || '';
                        const currentLine = activeEditor.selection.active.line + 1; // 1-based 行號。
                        const currentLineContent = activeEditor.document.lineAt(activeEditor.selection.active.line).text.trim();
                        
                        // 取得後續非空白行。
                        const nextLines = [];
                        let lineOffset = 1;
                        while (nextLines.length < numNextLines && 
                               activeEditor.selection.active.line + lineOffset < activeEditor.document.lineCount) {
                            const lineText = activeEditor.document.lineAt(activeEditor.selection.active.line + lineOffset).text.trim();
                            if (lineText.length > 0) {
                                nextLines.push(lineText);
                            }
                            lineOffset++;
                        }
                        
                        state.updateLocation(
                            activeEditor.document.fileName,
                            fileName,
                            currentLine,
                            currentLineContent,
                            nextLines
                        );
                    }
                }
            }
        } catch (error) {
            console.log('Unable to get debug state:', error);
        }
        
        // 將 breakpoints 填成精簡 "fileName:line" 字串。
        const breakpoints = vscode.debug.breakpoints;
        const formattedBreakpoints = breakpoints
            .filter((bp): bp is vscode.SourceBreakpoint => bp instanceof vscode.SourceBreakpoint)
            .map(bp => {
                const fileName = bp.location.uri.fsPath.split(/[/\\]/).pop() || 'unknown';
                const line = bp.location.range.start.line + 1;
                return `${fileName}:${line}`;
            });
        state.updateBreakpoints(formattedBreakpoints);

        return state;
    }

    /**
     * 使用 DAP stackTrace request 填入 frame name 與 stack trace。
     *
     * @param session active VS Code debug session。
     * @param frameId 目前 frame ID。保留此參數是為了 call-site clarity；stackTrace 使用 state 的 thread ID。
     * @param state 要更新 stack information 的 DebugState。
     */
    private async extractFrameName(session: vscode.DebugSession, frameId: number, state: DebugState): Promise<void> {
        try {
            // 取得完整 stack trace，最多 50 個 frames。
            const stackTraceResponse = await session.customRequest('stackTrace', {
                threadId: state.threadId,
                startFrame: 0,
                levels: 50
            });

            if (stackTraceResponse?.stackFrames && stackTraceResponse.stackFrames.length > 0) {
                // 從目前 frame 擷取 frame name。
                const currentFrame = stackTraceResponse.stackFrames[0];
                state.updateFrameName(currentFrame.name || null);

                // 建立 stack trace array。
                const stackTrace: StackFrame[] = stackTraceResponse.stackFrames.map((frame: any) => ({
                    name: frame.name || 'unknown',
                    source: frame.source?.path || frame.source?.name || undefined,
                    line: frame.line || undefined,
                    column: frame.column || undefined,
                }));

                state.updateStackTrace(stackTrace);
            }
        } catch (error) {
            console.log('Unable to extract stack info:', error);
            // 發生錯誤時設定空值。
            state.updateFrameName(null);
            state.updateStackTrace([]);
        }
    }

    /**
     * 透過 DAP scopes 與 variables requests 取得 stack frame 的 variables。
     *
     * @param frameId 要讀取 variables 的 DAP frame ID。
     * @param scope optional scope filter。"all" 或 undefined 會回傳所有 scopes。
     * @returns 包含 scope entries 的 object，每個 entry 可帶有 variables 或 error。
     * @throws Error 當 active session 不存在或 scopes request 失敗時丟出。
     */
    public async getVariables(frameId: number, scope?: 'local' | 'global' | 'all'): Promise<any> {
        try {
            const activeSession = vscode.debug.activeDebugSession;
            if (!activeSession) {
                throw new Error('No active debug session');
            }

            const response = await activeSession.customRequest('scopes', { frameId });
            
            if (!response || !response.scopes || response.scopes.length === 0) {
                return { scopes: [] };
            }

            const filteredScopes = response.scopes.filter((scopeItem: any) => {
                if (scope === 'all') {return true;}
                const scopeName = scopeItem.name.toLowerCase();
                if (scope === 'local') {return scopeName.includes('local');}
                if (scope === 'global') {return scopeName.includes('global');}
                return true;
            });

            // 取得每個 scope 的 variables。
            for (const scopeItem of filteredScopes) {
                try {
                    const variablesResponse = await activeSession.customRequest('variables', {
                        variablesReference: scopeItem.variablesReference
                    });
                    scopeItem.variables = variablesResponse.variables || [];
                } catch (scopeError) {
                    scopeItem.variables = [];
                    scopeItem.error = scopeError;
                }
            }

            return { scopes: filteredScopes };
        } catch (error) {
            throw new Error(`Failed to get variables: ${error}`);
        }
    }

    /**
     * 使用 DAP evaluate 在 stack frame 中評估 expression。
     *
     * @param expression debuggee language 中的 expression text。
     * @param frameId 作為 evaluation context 的 DAP frame ID。
     * @returns debug adapter 回傳的 raw DAP evaluate response。
     * @throws Error 當 active session 不存在或 evaluation 失敗時丟出。
     */
    public async evaluateExpression(expression: string, frameId: number): Promise<any> {
        try {
            const activeSession = vscode.debug.activeDebugSession;
            if (!activeSession) {
                throw new Error('No active debug session');
            }

            const response = await activeSession.customRequest('evaluate', {
                expression: expression,
                frameId: frameId,
                context: 'repl'
            });

            return response;
        } catch (error) {
            throw new Error(`Failed to evaluate expression: ${error}`);
        }
    }


    /**
     * 回傳 VS Code 已知的所有 breakpoints。
     *
     * @returns 來自 VS Code 的 readonly breakpoint collection。
     */
    public getBreakpoints(): readonly vscode.Breakpoint[] {
        return vscode.debug.breakpoints;
    }

    /**
     * 移除目前註冊在 VS Code 中的每個 breakpoint。
     */
    public clearAllBreakpoints(): void {
        const breakpoints = vscode.debug.breakpoints;
        if (breakpoints.length > 0) {
            vscode.debug.removeBreakpoints(breakpoints);
        }
    }

    /**
     * 檢查 active debug session 是否已 ready 可執行 debugger operations。
     *
     * readiness 需要 active session 與 source location information，因為
     * variables/evaluate 這類 commands 需要 paused execution frame。
     *
     * @returns 當 active session 具有可用 location information 時回傳 true。
     */
    public async hasActiveSession(): Promise<boolean> {
        // 先做快速檢查：完全沒有 session。
        if (!vscode.debug.activeDebugSession) {
            return false;
        }

        try {
            // 取得目前 debug state 並檢查是否具有 location information。
            // 這是判斷 debugger 是否真的 ready 的最可靠方式。
            const debugState = await this.getCurrentDebugState();
            
            // 當 session 具有 location info（file name 與 line number）時才算 ready。
            // 這表示 debugger 已 attached，且我們能看見目前在 code 的位置。
            return debugState.sessionActive && debugState.hasLocationInfo();
        } catch (error) {
            // 任何 error 都代表 session 尚未 ready，例如 Python 還在初始化。
            console.log('Session readiness check failed:', error);
            return false;
        }
    }

    /**
     * 回傳 VS Code 的 active debug session。
     *
     * @returns active session；沒有 active session 時為 undefined。
     */
    public getActiveSession(): vscode.DebugSession | undefined {
        return vscode.debug.activeDebugSession;
    }
}
