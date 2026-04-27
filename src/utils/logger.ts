// Copyright (c) Microsoft Corporation.

import * as vscode from 'vscode';

/**
 * DebugMCP logger 使用的最低 severity level。
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * VS Code LogOutputChannel 的 singleton wrapper。
 *
 * logger 會集中 extension diagnostics，並讓整個專案的 log formatting 維持一致。
 */
export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.LogOutputChannel;
    private logLevel: LogLevel = LogLevel.INFO;

    /**
     * 建立 DebugMCP output channel。
     *
     * constructor 為 private，因為 callers 應使用 getInstance()。
     */
    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('DebugMCP', { log: true });
    }

    /**
     * 取得 singleton logger instance。
     *
     * @returns extension host 共用的 Logger instance。
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * 檢查指定 level 的 message 是否應被輸出。
     *
     * @param level 正在判斷的 message severity。
     * @returns 當 message level 大於或等於目前設定的 log level 時回傳 true。
     */
    private shouldLog(level: LogLevel): boolean {
        return level >= this.logLevel;
    }

    /**
     * 寫入 debug-level message。
     *
     * @param message 要寫入的 message。
     * @param error optional error 或要附加的 diagnostic payload。
     */
    public debug(message: string, error?: any): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            if (error) {
                this.outputChannel.debug(`${message}: ${this.formatError(error)}`);
            } else {
                this.outputChannel.debug(message);
            }
        }
    }

    /**
     * 寫入 info-level message。
     *
     * @param message 要寫入的 message。
     * @param error optional error 或要附加的 diagnostic payload。
     */
    public info(message: string, error?: any): void {
        if (this.shouldLog(LogLevel.INFO)) {
            if (error) {
                this.outputChannel.info(`${message}: ${this.formatError(error)}`);
            } else {
                this.outputChannel.info(message);
            }
        }
    }

    /**
     * 寫入 warning-level message。
     *
     * @param message 要寫入的 message。
     * @param error optional error 或要附加的 diagnostic payload。
     */
    public warn(message: string, error?: any): void {
        if (this.shouldLog(LogLevel.WARN)) {
            if (error) {
                this.outputChannel.warn(`${message}: ${this.formatError(error)}`);
            } else {
                this.outputChannel.warn(message);
            }
        }
    }

    /**
     * 寫入 error-level message。
     *
     * @param message 要寫入的 message。
     * @param error optional error 或要附加的 diagnostic payload。
     */
    public error(message: string, error?: any): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            if (error) {
                this.outputChannel.error(`${message}: ${this.formatError(error)}`);
            } else {
                this.outputChannel.error(message);
            }
        }
    }

    /**
     * 將 error-like value 轉成 log output 使用的字串。
     *
     * @param error Error object 或任意 diagnostic payload。
     * @returns human-readable error text。
     */
    private formatError(error: any): string {
        if (error instanceof Error) {
            return `${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`;
        }
        return JSON.stringify(error, null, 2);
    }

    /**
     * 變更目前 active minimum log level。
     *
     * @param level 新的最低輸出 severity。
     */
    public setLogLevel(level: LogLevel): void {
        this.logLevel = level;
        this.info(`Log level set to ${LogLevel[level]}`);
    }

    /**
     * 記錄 VS Code 與 extension host runtime information。
     */
    public logSystemInfo(): void {
        this.info('=== System Information ===');
        this.info(`VS Code Version: ${vscode.version}`);
        this.info(`Platform: ${process.platform}`);
        this.info(`Architecture: ${process.arch}`);
        this.info(`Node.js Version: ${process.version}`);
        this.info(`Extension Host PID: ${process.pid}`);
        this.info('=== End System Information ===');
    }

    /**
     * 記錄支援診斷時有用的部分 environment variables。
     */
    public logEnvironment(): void {
        this.info('=== Environment Variables ===');
        this.info(`HOME: ${process.env.HOME || 'undefined'}`);
        this.info(`USERPROFILE: ${process.env.USERPROFILE || 'undefined'}`);
        this.info(`APPDATA: ${process.env.APPDATA || 'undefined'}`);
        this.info(`PATH: ${process.env.PATH?.substring(0, 200) || 'undefined'}...`);
        this.info('=== End Environment Variables ===');
    }

    /**
     * 在 VS Code 中顯示 DebugMCP output channel。
     */
    public show(): void {
        this.outputChannel.show();
    }
}

// 匯出 singleton instance，方便各處使用。
export const logger = Logger.getInstance();
