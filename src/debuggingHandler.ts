// Copyright (c) Microsoft Corporation.

import * as vscode from 'vscode';
import { IDebugConfigurationManager } from './utils/debugConfigurationManager';
import { DebugState } from './debugState';
import { IDebuggingExecutor } from './debuggingExecutor';
import { logger } from './utils/logger';

/**
 * 暴露給 MCP server 的高階 debugger operations。
 *
 * 實作會將已驗證的 MCP tool arguments 轉成 debugger actions，在需要時等待
 * state transitions，並回傳格式化後適合 AI agent 消費的字串。
 */
export interface IDebuggingHandler {
    /** 為 source file 或 test target 啟動 debug session。 */
    handleStartDebugging(args: { fileFullPath: string; workingDirectory: string; testName?: string; configurationName?: string }): Promise<string>;
    /** 若 active debug session 存在則停止它。 */
    handleStopDebugging(): Promise<string>;
    /** 執行 step-over operation 並回傳結果 debug state。 */
    handleStepOver(): Promise<string>;
    /** 執行 step-into operation 並回傳結果 debug state。 */
    handleStepInto(): Promise<string>;
    /** 執行 step-out operation 並回傳結果 debug state。 */
    handleStepOut(): Promise<string>;
    /** 繼續執行直到下一個 stop event 或 session 完成。 */
    handleContinue(): Promise<string>;
    /** 重新啟動 active debug session。 */
    handleRestart(): Promise<string>;
    /** 對所有包含指定 source text 的行新增 breakpoints。 */
    handleAddBreakpoint(args: { fileFullPath: string; lineContent: string }): Promise<string>;
    /** 移除指定 1-based 行號上的 breakpoint。 */
    handleRemoveBreakpoint(args: { fileFullPath: string; line: number }): Promise<string>;
    /** 清除所有 VS Code breakpoints。 */
    handleClearAllBreakpoints(): Promise<string>;
    /** 回傳格式化後的 active breakpoints 清單。 */
    handleListBreakpoints(): Promise<string>;
    /** 回傳 active stack frame 中的 variables。 */
    handleGetVariables(args: { scope?: 'local' | 'global' | 'all' }): Promise<string>;
    /** 在 active stack frame 中評估 expression。 */
    handleEvaluateExpression(args: { expression: string }): Promise<string>;
}

/**
 * 協調 MCP tools 與低階 VS Code APIs 之間的 debugger actions。
 *
 * 此 class 負責 operation sequencing、readiness checks、before/after state
 * comparison、timeout handling 與 response formatting。它依賴 execution 與
 * configuration interfaces，讓 tests 可以將 orchestration logic 與 VS Code 隔離。
 */
export class DebuggingHandler implements IDebuggingHandler {
    private readonly numNextLines: number = 3;
    private readonly executionDelay: number = 300; // 等待 debugger updates 的毫秒數。
    private readonly timeoutInSeconds: number;

    /**
     * 建立具備 injected collaborators 的 debugging handler。
     *
     * @param executor VS Code debug commands 與 DAP requests 的低階 adapter。
     * @param configManager debug configuration resolver。
     * @param timeoutInSeconds 等待 debug session readiness/state changes 的最長秒數。
     */
    constructor(
        private readonly executor: IDebuggingExecutor,
        private readonly configManager: IDebugConfigurationManager,
        timeoutInSeconds: number
    ) {
        this.timeoutInSeconds = timeoutInSeconds;
    }

    /**
     * 啟動 debugging session 並回傳初始狀態。
     *
     * 此方法會提示或解析 configuration、啟動 session、等待 VS Code 回報可用的
     * execution location，然後回傳目前 DebugState JSON。
     *
     * @param args file path、working directory、optional test name 與 optional launch configuration name。
     * @returns 帶有目前 debug state 的 success message。
     * @throws Error 當 configuration resolution、session startup 或 readiness waiting 失敗時丟出。
     */
    public async handleStartDebugging(args: { 
        fileFullPath: string; 
        workingDirectory: string;
        testName?: string;
        configurationName?: string;
    }): Promise<string> {
        const { fileFullPath, workingDirectory, testName, configurationName } = args;
        
        try {            
            let selectedConfigName = configurationName ?? await this.configManager.promptForConfiguration(workingDirectory);
            
            // 從 launch.json 取得 debug configuration，或建立 default configuration。
            const debugConfig = await this.configManager.getDebugConfig(
                workingDirectory, 
                fileFullPath, 
                selectedConfigName,
                testName
            );

            const started = await this.executor.startDebugging(workingDirectory, debugConfig);
            if (started) {
                // 使用 exponential backoff 等待 debug session 變成 active。
                const sessionActive = await this.waitForActiveDebugSession();
                
                if (!sessionActive) {
                    throw new Error('Debug session started but failed to become active within timeout period');
                }
                
                // 同時回傳目前狀態。
                const configInfo = selectedConfigName ? ` using configuration '${selectedConfigName}'` : ' with default configuration';
                const testInfo = testName ? ` (test: ${testName})` : '';
                const currentState = await this.executor.getCurrentDebugState(this.numNextLines);
                return `Debug session started successfully for: ${fileFullPath}${configInfo}${testInfo}. Current state: ${currentState.toString()}`;
            } else {
                throw new Error('Failed to start debug session. Make sure the appropriate language extension is installed.');
            }
        } catch (error) {
            throw new Error(`Error starting debug session: ${error}`);
        }
    }

    /**
     * 停止目前 debugging session。
     *
     * @returns status message；停止 session 時會包含 root-cause analysis checkpoint。
     * @throws Error 當 VS Code 無法停止 active session 時丟出。
     */
    public async handleStopDebugging(): Promise<string> {
        try {
            if (!(await this.executor.hasActiveSession())) {
                return 'No active debug session to stop';
            }

            await this.executor.stopDebugging();

            // 加入深入追查提醒。
            return 'Debug session stopped successfully\n\n' + this.getRootCauseAnalysisCheckpointMessage();
        } catch (error) {
            throw new Error(`Error stopping debug session: ${error}`);
        }
    }

    /**
     * 移除目前註冊在 VS Code 中的所有 breakpoints。
     *
     * @returns 描述 breakpoints 是否已清除的 message。
     * @throws Error 當 breakpoint removal 失敗時丟出。
     */
    public async handleClearAllBreakpoints(): Promise<string> {
        try {
            const breakpointCount = this.executor.getBreakpoints().length;
            
            if (breakpointCount === 0) {
                return 'No breakpoints to clear';
            }

            this.executor.clearAllBreakpoints();
            return `Successfully cleared ${breakpointCount} breakpoint(s)`;
        } catch (error) {
            throw new Error(`Error clearing breakpoints: ${error}`);
        }
    }

    /**
     * 執行 step-over command 並回傳結果 debugger state。
     *
     * optional args parameter 目前只存在於 method shape，implementation 與 MCP
     * schema 尚未使用。
     *
     * @param args 未來可用於 multi-step execution 的 optional extension point。
     * @returns meaningful state change 或 timeout 後的 DebugState JSON。
     * @throws Error 當沒有 ready active session 或 command 失敗時丟出。
     */
    public async handleStepOver(args?: { steps?: number }): Promise<string> {
        try {
            if (!(await this.executor.hasActiveSession())) {
                throw new Error('Debug session is not ready. Please wait for initialization to complete.');
            }

            // 執行 command 前先取得 state。
            const beforeState = await this.executor.getCurrentDebugState(this.numNextLines);

            await this.executor.stepOver();
            
            // 等待 debugger state 改變。
            const afterState = await this.waitForStateChange(beforeState);

            return afterState.toString();
        } catch (error) {
            throw new Error(`Error executing step over: ${error}`);
        }
    }

    /**
     * 執行 step-into command 並回傳結果 debugger state。
     *
     * @returns meaningful state change 或 timeout 後的 DebugState JSON。
     * @throws Error 當沒有 ready active session 或 command 失敗時丟出。
     */
    public async handleStepInto(): Promise<string> {
        try {
            if (!(await this.executor.hasActiveSession())) {
                throw new Error('Debug session is not ready. Please wait for initialization to complete.');
            }

            // 執行 command 前先取得 state。
            const beforeState = await this.executor.getCurrentDebugState(this.numNextLines);

            await this.executor.stepInto();
            
            // 等待 debugger state 改變。
            const afterState = await this.waitForStateChange(beforeState);
            
            return afterState.toString();
        } catch (error) {
            throw new Error(`Error executing step into: ${error}`);
        }
    }

    /**
     * 執行 step-out command 並回傳結果 debugger state。
     *
     * @returns meaningful state change 或 timeout 後的 DebugState JSON。
     * @throws Error 當沒有 ready active session 或 command 失敗時丟出。
     */
    public async handleStepOut(): Promise<string> {
        try {
            if (!(await this.executor.hasActiveSession())) {
                throw new Error('Debug session is not ready. Please wait for initialization to complete.');
            }

            // 執行 command 前先取得 state。
            const beforeState = await this.executor.getCurrentDebugState(this.numNextLines);

            await this.executor.stepOut();
            
            // 等待 debugger state 改變。
            const afterState = await this.waitForStateChange(beforeState);
            
            return afterState.toString();
        } catch (error) {
            throw new Error(`Error executing step out: ${error}`);
        }
    }

    /**
     * 繼續執行程式，直到 debugger 再次停止或 session 結束。
     *
     * @returns meaningful state change 或 timeout 後的 DebugState JSON。
     * @throws Error 當沒有 ready active session 或 command 失敗時丟出。
     */
    public async handleContinue(): Promise<string> {
        try {
            if (!(await this.executor.hasActiveSession())) {
                throw new Error('Debug session is not ready. Please wait for initialization to complete.');
            }

            // 執行 command 前先取得 state。
            const beforeState = await this.executor.getCurrentDebugState(this.numNextLines);

            await this.executor.continue();
            
            // 等待 debugger state 改變。
            const afterState = await this.waitForStateChange(beforeState);
            
            return afterState.toString();
        } catch (error) {
            throw new Error(`Error executing continue: ${error}`);
        }
    }

    /**
     * 重新啟動 active debugging session。
     *
     * @returns restart command 發出後的 status message。
     * @throws Error 當 active session 不存在或 restart 失敗時丟出。
     */
    public async handleRestart(): Promise<string> {
        try {
            if (!(await this.executor.hasActiveSession())) {
                throw new Error('No active debug session to restart');
            }

            await this.executor.restart();
            
            // 等待 debugger restart。
            await new Promise(resolve => setTimeout(resolve, this.executionDelay));

            return 'Debug session restarted successfully';
        } catch (error) {
            throw new Error(`Error restarting debug session: ${error}`);
        }
    }

    /**
     * 對所有包含指定 source text 的行新增 breakpoints。
     *
     * MCP tool 接受 line content，因為 AI agents 通常比起精準行號更可靠地引用
     * code text。若文字出現多次，每個 matching line 都會收到 breakpoint。
     *
     * @param args target file 與要搜尋的 source text。
     * @returns 列出已新增 breakpoints 行號的 message。
     * @throws Error 當找不到文字或 VS Code 無法新增 breakpoint 時丟出。
     */
    public async handleAddBreakpoint(args: { fileFullPath: string; lineContent: string }): Promise<string> {
        const { fileFullPath, lineContent } = args;
        
        try {
            // 找出包含 line content 的行號。
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fileFullPath));
            const text = document.getText();
            const lines = text.split(/\r?\n/);
            const matchingLineNumbers: number[] = [];
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(lineContent)) {
                    matchingLineNumbers.push(i + 1); // 轉成 1-based 行號。
                }
            }
            
            if (matchingLineNumbers.length === 0) {
                throw new Error(`Could not find any lines containing: ${lineContent}`);
            }
            
            const uri = vscode.Uri.file(fileFullPath);
            
            // 對所有 matching lines 新增 breakpoints。
            for (const lineNumber of matchingLineNumbers) {
                await this.executor.addBreakpoint(uri, lineNumber);
            }
            
            if (matchingLineNumbers.length === 1) {
                return `Breakpoint added at ${fileFullPath}:${matchingLineNumbers[0]}`;
            } else {
                const linesList = matchingLineNumbers.join(', ');
                return `Breakpoints added at ${matchingLineNumbers.length} locations in ${fileFullPath}: lines ${linesList}`;
            }
        } catch (error) {
            throw new Error(`Error adding breakpoint: ${error}`);
        }
    }

    /**
     * 移除指定 1-based source line 上的 breakpoint。
     *
     * @param args target file 與 1-based 行號。
     * @returns 描述 breakpoint 是否已移除的 message。
     * @throws Error 當 breakpoint lookup 或 removal 失敗時丟出。
     */
    public async handleRemoveBreakpoint(args: { fileFullPath: string; line: number }): Promise<string> {
        const { fileFullPath, line } = args;
        
        try {
            const uri = vscode.Uri.file(fileFullPath);
            
            // 檢查此位置是否存在 breakpoint。
            const breakpoints = this.executor.getBreakpoints();
            const existingBreakpoint = breakpoints.find(bp => {
                if (bp instanceof vscode.SourceBreakpoint) {
                    return bp.location.uri.toString() === uri.toString() && 
                           bp.location.range.start.line === line - 1;
                }
                return false;
            });
            
            if (!existingBreakpoint) {
                return `No breakpoint found at ${fileFullPath}:${line}`;
            }
            
            await this.executor.removeBreakpoint(uri, line);
            return `Breakpoint removed from ${fileFullPath}:${line}`;
        } catch (error) {
            throw new Error(`Error removing breakpoint: ${error}`);
        }
    }

    /**
     * 回傳所有 active VS Code breakpoints 的格式化清單。
     *
     * @returns human-readable breakpoint list 或 empty-state message。
     * @throws Error 當 breakpoint enumeration 失敗時丟出。
     */
    public async handleListBreakpoints(): Promise<string> {
        try {
            const breakpoints = this.executor.getBreakpoints();
            
            if (breakpoints.length === 0) {
                return 'No breakpoints currently set';
            }

            let breakpointList = 'Active Breakpoints:\n';
            breakpoints.forEach((bp, index) => {
                if (bp instanceof vscode.SourceBreakpoint) {
                    const fileName = bp.location.uri.fsPath.split(/[/\\]/).pop();
                    const line = bp.location.range.start.line + 1;
                    breakpointList += `${index + 1}. ${fileName}:${line}\n`;
                } else if (bp instanceof vscode.FunctionBreakpoint) {
                    breakpointList += `${index + 1}. Function: ${bp.functionName}\n`;
                }
            });

            return breakpointList;
        } catch (error) {
            throw new Error(`Error listing breakpoints: ${error}`);
        }
    }

    /**
     * 從目前選取的 stack frame 取得 variables。
     *
     * @param args optional scope filter：local、global 或 all。
     * @returns 格式化後的 variable scopes 與 variable values。
     * @throws Error 當沒有可用 paused stack frame 或 DAP variable retrieval 失敗時丟出。
     */
    public async handleGetVariables(args: { scope?: 'local' | 'global' | 'all' }): Promise<string> {
        const { scope = 'all' } = args;
        
        try {
            if (!(await this.executor.hasActiveSession())) {
                throw new Error('Debug session is not ready. Start debugging first and ensure execution is paused.');
            }

            const activeStackItem = vscode.debug.activeStackItem;
            if (!activeStackItem || !('frameId' in activeStackItem)) {
                throw new Error('No active stack frame. Make sure execution is paused at a breakpoint.');
            }

            const variablesData = await this.executor.getVariables(activeStackItem.frameId, scope);
            
            if (!variablesData.scopes || variablesData.scopes.length === 0) {
                return 'No variable scopes available at current execution point.';
            }

            let variablesInfo = 'Variables:\n==========\n\n';

            for (const scopeItem of variablesData.scopes) {
                variablesInfo += `${scopeItem.name}:\n`;
                
                if (scopeItem.error) {
                    variablesInfo += `  Error retrieving variables: ${scopeItem.error}\n`;
                } else if (scopeItem.variables && scopeItem.variables.length > 0) {
                    for (const variable of scopeItem.variables) {
                        variablesInfo += `  ${variable.name}: ${variable.value}`;
                        if (variable.type) {
                            variablesInfo += ` (${variable.type})`;
                        }
                        variablesInfo += '\n';
                    }
                } else {
                    variablesInfo += '  No variables in this scope\n';
                }
                
                variablesInfo += '\n';
            }

            return variablesInfo;
        } catch (error) {
            throw new Error(`Error getting variables: ${error}`);
        }
    }

    /**
     * 在目前選取的 stack frame 中評估 expression。
     *
     * @param args target program 語言中的 expression string。
     * @returns 格式化後的 expression result 與 optional result type。
     * @throws Error 當沒有可用 paused stack frame 或 DAP evaluation 失敗時丟出。
     */
    public async handleEvaluateExpression(args: { expression: string }): Promise<string> {
        const { expression } = args;
        
        try {
            if (!(await this.executor.hasActiveSession())) {
                throw new Error('Debug session is not ready. Start debugging first and ensure execution is paused.');
            }

            const activeStackItem = vscode.debug.activeStackItem;
            if (!activeStackItem || !('frameId' in activeStackItem)) {
                throw new Error('No active stack frame. Make sure execution is paused at a breakpoint.');
            }

            const response = await this.executor.evaluateExpression(expression, activeStackItem.frameId);

            if (response && response.result !== undefined) {
                let resultText = `Expression: ${expression}\n`;
                resultText += `Result: ${response.result}`;
                if (response.type) {
                    resultText += ` (${response.type})`;
                }

                return resultText;
            } else {
                throw new Error('Failed to evaluate expression');
            }
        } catch (error) {
            throw new Error(`Error evaluating expression: ${error}`);
        }
    }

    /**
     * 取得目前 debug state snapshot。
     *
     * @returns 由 executor 填入資料的 DebugState。
     */
    public async getCurrentDebugState(): Promise<DebugState> {
        return await this.executor.getCurrentDebugState(this.numNextLines);
    }

    /**
     * 判斷 debugger 是否具有 active 且 ready 的 session。
     *
     * @returns 當 executor 回報具有 location info 的 active session 時回傳 true。
     */
    public async isDebuggingActive(): Promise<boolean> {
        return await this.executor.hasActiveSession();
    }

    /**
     * 等待直到 VS Code 暴露具有 source location 的 active debug session。
     *
     * polling 使用 exponential backoff 與 jitter，並在設定的 operation timeout
     * 後停止。
     *
     * @returns 當 session 在 timeout 前變成 ready 時回傳 true。
     */
    private async waitForActiveDebugSession(): Promise<boolean> {
        const baseDelay = 1000; // 從 1 秒開始。
        const maxDelay = 10000; // 上限為 10 秒。
        
        const startTime = Date.now();
        let attempt = 0;
        
        while (Date.now() - startTime < this.timeoutInSeconds * 1000) {
            if (await this.executor.hasActiveSession()) {
                logger.info('Debug session is now active!');
                return true;
            }
            
            logger.info(`[Attempt ${attempt + 1}] Waiting for debug session to become active...`);

            // 使用 exponential backoff 與 jitter 計算 delay。
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            const jitteredDelay = delay + Math.random() * 200; // 最多加入 200ms jitter。
            
            await new Promise(resolve => setTimeout(resolve, jitteredDelay));
            attempt++;
        }
        
        return false; // 已達 timeout。
    }

    /**
     * 等待 command 之後的 debugger state 改變。
     *
     * command 可能需要時間更新 VS Code 的 active frame/editor。此方法會持續
     * polling，直到觀察到 meaningful change、session 結束或 operation timeout。
     *
     * @param beforeState debug command 前立即擷取的 state。
     * @returns updated state；若達 timeout 則回傳 latest state。
     */
    private async waitForStateChange(beforeState: DebugState): Promise<DebugState> {
        const baseDelay = 1000; // 從 1 秒開始。
        const maxDelay = 1000; // 上限為 1 秒。
        const startTime = Date.now();
        let attempt = 0;
                
        while (Date.now() - startTime < this.timeoutInSeconds * 1000) {
            const currentState = await this.executor.getCurrentDebugState(this.numNextLines);
            
            if (this.hasStateChanged(beforeState, currentState)) {
                return currentState;
            }
            
            // 若 session 已結束，立即回傳。
            if (!currentState.sessionActive) {
                return currentState;
            }
            
            logger.info(`[Attempt ${attempt + 1}] Waiting for debugger state to change...`);

            // 使用 exponential backoff 與 jitter 計算 delay，與 waitForActiveDebugSession 相同。
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            const jitteredDelay = delay + Math.random() * 200; // 最多加入 200ms jitter。

            await new Promise(resolve => setTimeout(resolve, jitteredDelay));
            attempt++;
        }
        
        // 若達 timeout，回傳目前 state（可能未改變）。
        logger.info('State change detection timed out, returning current state');
        return await this.executor.getCurrentDebugState(this.numNextLines);
    }

    /**
     * 判斷兩個 debug states 是否有 agents 應該觀察到的差異。
     *
     * location、frame identity、frame name 與 session active status 都算
     * meaningful changes。若先前已有 location，後續短暫出現 active 但無 location
     * 的 state，會被忽略以避免回報不完整更新。
     *
     * @param beforeState operation 前擷取的 state。
     * @param afterState operation 後擷取的 candidate state。
     * @returns 當 after state 應被視為 changed 並回傳時為 true。
     */
    private hasStateChanged(beforeState: DebugState, afterState: DebugState): boolean {
        if (beforeState.hasLocationInfo() && !afterState.hasLocationInfo() && afterState.sessionActive) {
            return false;
        }

        // session status 改變就是 meaningful change。
        if (beforeState.sessionActive !== afterState.sessionActive) {
            return true;
        }
        
        // session 不再 active 也是 change。
        if (!afterState.sessionActive) {
            return true;
        }
        
        // 若任一 state 缺少 location info，就比較可比較的部分。
        if (!beforeState.hasLocationInfo() || !afterState.hasLocationInfo()) {
            // 若一方有 location info 而另一方沒有，這就是 change。
            return beforeState.hasLocationInfo() !== afterState.hasLocationInfo();
        }
        
        // 比較 file paths；若移動到不同檔案就是 change。
        if (beforeState.fileFullPath !== afterState.fileFullPath) {
            return true;
        }
        
        // 比較 line numbers；若移動到不同行就是 change。
        if (beforeState.currentLine !== afterState.currentLine) {
            return true;
        }
        
        // 比較 frame names；若移動到不同 function/method 就是 change。
        if (beforeState.frameName !== afterState.frameName) {
            return true;
        }
        
        // 比較 frame IDs；這代表 internal frame change。
        if (beforeState.frameId !== afterState.frameId) {
            return true;
        }
        
        // 走到這裡表示沒有偵測到 meaningful change。
        return false;
    }

    /**
     * 建立 debugging 停止時附加的 root-cause analysis reminder。
     *
     * @returns 鼓勵 agents 區分 symptoms 與 causes 的 Markdown reminder。
     */
    private getRootCauseAnalysisCheckpointMessage(): string {
        return `⚠️ **ROOT CAUSE ANALYSIS CHECKPOINT**

Before concluding your debugging session:

❓ **CRITICAL QUESTION:** Have you found the ROOT CAUSE or just a SYMPTOM?

🔍 **If you only identified WHERE it went wrong:**
- Variable is null/undefined
- Function returned unexpected value  
- Error occurred at specific line
- Condition evaluated incorrectly

➡️ **You likely found a SYMPTOM - Continue debugging!**

ROOT CAUSE means understanding WHY the issue occurred in the first place, for example due to:
- Incorrect variable initialization
- Logic error in function implementation
- Missing error handling
- Faulty assumptions in conditions

REQUIRED NEXT STEPS:
1. Use 'add_breakpoint' to set breakpoints at investigation points
2. Use 'start_debugging' to trace from the beginning
3. Investigate WHY the issue occurred, not just WHAT happened
4. Repeat the process as necessary until the ROOT CAUSE is identified`;
    }
}
