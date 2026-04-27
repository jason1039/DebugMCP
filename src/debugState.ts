// Copyright (c) Microsoft Corporation.

/**
 * debug adapter 回傳的單一 stack frame 精簡表示。
 *
 * 這個型別刻意只保留 DebugMCP 會回傳給 agents 的欄位，而不是完整映射
 * DAP stack frame 物件。
 */
export interface StackFrame {
    /** function、method 或 frame 的顯示名稱。 */
    name: string;
    /** debug adapter 回報的 source path 或 source name。 */
    source?: string;
    /** 可取得時的 1-based 行號。 */
    line?: number;
    /** 可取得時的 1-based 欄號。 */
    column?: number;
}

/**
 * 回傳給 MCP clients 的目前 debugger 狀態快照。
 *
 * debugging 操作會用此 model 比較操作前後狀態，並格式化成精簡 JSON
 * 回應給 AI agents。此 class 儲存 plain values 而非 VS Code 物件，
 * 因此可以安全 clone 與序列化。
 */
export class DebugState {
    public sessionActive: boolean;
    public fileFullPath: string | null;
    public fileName: string | null;
    public currentLine: number | null;
    public currentLineContent: string | null;
    public nextLines: string[];
    public frameId: number | null;
    public threadId: number | null;
    public frameName: string | null;
    public stackTrace: StackFrame[];
    public configurationName: string | null;
    public breakpoints: string[];
    
    constructor() {
        this.sessionActive = false;
        this.fileFullPath = null;
        this.fileName = null;
        this.currentLine = null;
        this.currentLineContent = null;
        this.nextLines = [];
        this.frameId = null;
        this.threadId = null;
        this.frameName = null;
        this.stackTrace = [];
        this.configurationName = null;
        this.breakpoints = [];
    }

    /**
     * 將所有欄位重設為初始的非啟用 session 狀態。
     */
    public reset(): void {
        this.sessionActive = false;
        this.fileFullPath = null;
        this.fileName = null;
        this.currentLine = null;
        this.currentLineContent = null;
        this.nextLines = [];
        this.frameId = null;
        this.threadId = null;
        this.frameName = null;
        this.stackTrace = [];
        this.configurationName = null;
        this.breakpoints = [];
    }

    /**
     * 判斷此狀態是否具備 DAP requests 所需的 execution context。
     *
     * @returns 當 session active 且 frame/thread ID 都已知時回傳 true。
     */
    public hasValidContext(): boolean {
        return this.sessionActive && 
               this.frameId !== null && 
               this.threadId !== null;
    }

    /**
     * 判斷 debugger 是否具有具體 source location。
     *
     * @returns 當 file name 與 current line 都有值時回傳 true。
     */
    public hasLocationInfo(): boolean {
        return this.fileName !== null && 
               this.currentLine !== null;
    }

    /**
     * 儲存 debugger requests 使用的 frame 與 thread ID。
     *
     * @param frameId 所選 stack frame 的 DAP frame ID。
     * @param threadId 擁有所選 frame 的 DAP thread ID。
     */
    public updateContext(frameId: number, threadId: number): void {
        this.frameId = frameId;
        this.threadId = threadId;
    }

    /**
     * 儲存目前 source location 與附近 source 預覽。
     *
     * @param fileFullPath active source file 的絕對路徑。
     * @param fileName active source file 的 basename。
     * @param currentLine 1-based 目前執行行號。
     * @param currentLineContent 目前行去除前後空白後的內容。
     * @param nextLines 目前行後方去除前後空白的非空白行。
     */
    public updateLocation(
        fileFullPath: string,
        fileName: string,
        currentLine: number,
        currentLineContent: string,
        nextLines: string[]
    ): void {
        this.fileFullPath = fileFullPath;
        this.fileName = fileName;
        this.currentLine = currentLine;
        this.currentLineContent = currentLineContent;
        this.nextLines = [...nextLines];
    }

    /**
     * 儲存所選 stack frame 的顯示名稱。
     *
     * @param frameName function/frame 名稱；無法取得時為 null。
     */
    public updateFrameName(frameName: string | null): void {
        this.frameName = frameName;
    }

    /**
     * 用 defensive copy 取代已儲存的 stack trace。
     *
     * @param stackTrace 從目前 frame 往外排列的精簡 stack frames。
     */
    public updateStackTrace(stackTrace: StackFrame[]): void {
        this.stackTrace = [...stackTrace];
    }

    /**
     * 判斷所選 frame 是否有顯示名稱。
     *
     * @returns 當 frameName 有值時回傳 true。
     */
    public hasFrameName(): boolean {
        return this.frameName !== null;
    }

    /**
     * 儲存 active debug configuration 名稱。
     *
     * @param configurationName debug configuration 名稱；未知時為 null。
     */
    public updateConfigurationName(configurationName: string | null): void {
        this.configurationName = configurationName;
    }

    /**
     * 用 defensive copy 取代 active breakpoint 摘要。
     *
     * @param breakpoints 格式為精簡 "fileName:line" 字串的 breakpoints。
     */
    public updateBreakpoints(breakpoints: string[]): void {
        this.breakpoints = [...breakpoints];
    }

    /**
     * 建立此快照的 shallow value clone。
     *
     * arrays 會被複製，因此 callers 可以修改 clone，而不會影響原本用於
     * before/after 比較的 state。
     *
     * @returns 具有相同欄位值的新 DebugState。
     */
    public clone(): DebugState {
        const cloned = new DebugState();
        cloned.sessionActive = this.sessionActive;
        cloned.fileFullPath = this.fileFullPath;
        cloned.fileName = this.fileName;
        cloned.currentLine = this.currentLine;
        cloned.currentLineContent = this.currentLineContent;
        cloned.nextLines = [...this.nextLines];
        cloned.frameId = this.frameId;
        cloned.threadId = this.threadId;
        cloned.frameName = this.frameName;
        cloned.stackTrace = [...this.stackTrace];
        cloned.configurationName = this.configurationName;
        cloned.breakpoints = [...this.breakpoints];
        return cloned;
    }

    /**
     * 將此 state 格式化成 MCP tool responses 使用的精簡 JSON。
     *
     * inactive sessions 只包含 session flag。active sessions 會包含 execution
     * location、context IDs、stack trace 摘要與 breakpoints。
     *
     * @returns 適合 agent 消費的 pretty-printed JSON 字串。
     */
    public toString(): string {
        const stateObject: {
            sessionActive: boolean;
            configurationName?: string | null;
            stackTrace?: string[];
            breakpoints?: string[];
            fileFullPath?: string | null;
            fileName?: string | null;
            currentLine?: number | null;
            currentLineContent?: string | null;
            nextLines?: string[];
            frameId?: number | null;
            threadId?: number | null;
            frameName?: string | null;
        } = {
            sessionActive: this.sessionActive,
        };

        if (this.sessionActive) {
            stateObject.configurationName = this.configurationName;

            // 精簡 stack trace，格式為 "functionName:line"。
            stateObject.stackTrace = this.stackTrace.map(frame => 
                `${frame.name}:${frame.line || '?'}`
            );

            stateObject.breakpoints = this.breakpoints;

            stateObject.fileFullPath = this.fileFullPath;
            stateObject.fileName = this.fileName;
            stateObject.currentLine = this.currentLine;
            stateObject.currentLineContent = this.currentLineContent;
            stateObject.nextLines = this.nextLines;
            stateObject.frameId = this.frameId;
            stateObject.threadId = this.threadId;
            stateObject.frameName = this.frameName;
        }

        return JSON.stringify(stateObject, null, 2);
    }
}
