// Copyright (c) Microsoft Corporation.

import * as vscode from 'vscode';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import {
    DebuggingExecutor,
    ConfigurationManager,
    DebuggingHandler,
    IDebuggingHandler
} from '.';
import { logger } from './utils/logger';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

/**
 * 將 VS Code debugging operations 暴露給 AI agents 的內嵌 MCP server。
 *
 * server 負責 MCP protocol surface、HTTP endpoint、tool/resource 註冊與
 * lifecycle。所有 debugger orchestration 都委派給 IDebuggingHandler，
 * 讓 protocol 關注點與 VS Code debug API 呼叫維持分離。
 */
export class DebugMCPServer {
    private mcpServer: McpServer | null = null;
    private httpServer: http.Server | null = null;
    private port: number;
    private initialized: boolean = false;
    private debuggingHandler: IDebuggingHandler;
    private transports: Map<string, StreamableHTTPServerTransport> = new Map();

    /**
     * 建立 DebugMCP server 與預設 debugging collaborators。
     *
     * @param port 本機 MCP endpoint 使用的 HTTP port。
     * @param timeoutInSeconds 等待狀態的 debugging operations 所使用的 timeout。
     */
    constructor(port: number, timeoutInSeconds: number) {
        // 使用 dependency injection 初始化 debugging components。
        const executor = new DebuggingExecutor();
        const configManager = new ConfigurationManager();
        this.debuggingHandler = new DebuggingHandler(executor, configManager, timeoutInSeconds);
        this.port = port;
    }

    /**
     * 初始化 MCP SDK server 並註冊 tools/resources。
     *
     * 重複呼叫此方法是安全的；後續呼叫會直接返回，不會重複註冊 MCP surface。
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        this.mcpServer = new McpServer({
            name: 'debugmcp',
            version: '1.0.0',
        });

        this.setupTools();
        this.setupResources();
        this.initialized = true;
    }

    /**
     * 註冊 DebugMCP 暴露的所有 MCP tools。
     *
     * 每個 tool 都在 MCP 層進行 schema validation，將 operation 委派給
     * debugging handler，並把 string result 包成 MCP text content。
     */
    private setupTools() {
        // 取得 debug instructions 的 tool，用於 GitHub Copilot 這類不支援 MCP resources 的 clients。
        this.mcpServer!.registerTool('get_debug_instructions', {
            description: 'Get the debugging guide with step-by-step instructions for effective debugging. ' +
                'Returns comprehensive guidance including breakpoint strategies, root cause analysis framework, ' +
                'and best practices. Call this before starting a debug session.',
        }, async () => {
            const content = await this.loadMarkdownFile('agent-resources/debug_instructions.md');
            return { content: [{ type: 'text' as const, text: content }] };
        });

        // 啟動 debugging 的 tool。
        this.mcpServer!.registerTool('start_debugging', {
            description: 'IMPORTANT DEBUGGING TOOL - Start a debug session for a code file' +
                '\n\nUSE THIS WHEN:' +
                '\n• Any bug, error, or unexpected behavior occurs' +
                '\n• Asked to debug a unit test' +
                '\n• Variables have wrong/null values' +
                '\n• Functions return incorrect results' +
                '\n• Code behaves differently than expected' +
                '\n• User reports "it doesn\'t work"' +
                '\n\n⚠️ CRITICAL: Before using this tool, first call get_debug_instructions or read debugmcp://docs/debug_instructions resource!',
            inputSchema: {
                fileFullPath: z.string().describe('Full path to the source code file to debug'),
                workingDirectory: z.string().describe('Working directory for the debug session'),
                testName: z.string().optional().describe(
                    'Name of a specific test name to debug. ' +
                    'Only provide this when debugging a single test method. ' +
                    'Leave empty to debug the entire file or test class.'
                ),
                configurationName: z.string().optional().describe(
                    'Name of a specific debug configuration from launch.json to use. ' +
                    'Leave empty to be prompted to select a configuration interactively.'
                ),
            },
        }, async (args: { fileFullPath: string; workingDirectory: string; testName?: string; configurationName?: string }) => {
            const result = await this.debuggingHandler.handleStartDebugging(args);
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // 停止 debugging 的 tool。
        this.mcpServer!.registerTool('stop_debugging', {
            description: 'Stop the current debug session',
        }, async () => {
            const result = await this.debuggingHandler.handleStopDebugging();
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // step over tool。
        this.mcpServer!.registerTool('step_over', {
            description: 'Execute the current line of code without diving into it.',
        }, async () => {
            const result = await this.debuggingHandler.handleStepOver();
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // step into tool。
        this.mcpServer!.registerTool('step_into', {
            description: 'Dive into the current line of code.',
        }, async () => {
            const result = await this.debuggingHandler.handleStepInto();
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // step out tool。
        this.mcpServer!.registerTool('step_out', {
            description: 'Step out of the current function',
        }, async () => {
            const result = await this.debuggingHandler.handleStepOut();
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // continue execution tool。
        this.mcpServer!.registerTool('continue_execution', {
            description: 'Resume program execution until the next breakpoint is hit or the program completes.',
        }, async () => {
            const result = await this.debuggingHandler.handleContinue();
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // restart debugging tool。
        this.mcpServer!.registerTool('restart_debugging', {
            description: 'Restart the debug session from the beginning with the same configuration.',
        }, async () => {
            const result = await this.debuggingHandler.handleRestart();
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // 新增 breakpoint 的 tool。
        this.mcpServer!.registerTool('add_breakpoint', {
            description: 'Set a breakpoint to pause execution at a critical line of code. Essential for debugging: pause before potential errors, examine state at decision points, or verify code paths. Breakpoints let you inspect variables and control flow at exact moments.',
            inputSchema: {
                fileFullPath: z.string().describe('Full path to the file'),
                lineContent: z.string().describe('Line content'),
            },
        }, async (args: { fileFullPath: string; lineContent: string }) => {
            const result = await this.debuggingHandler.handleAddBreakpoint(args);
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // 移除 breakpoint 的 tool。
        this.mcpServer!.registerTool('remove_breakpoint', {
            description: 'Remove a breakpoint that is no longer needed.',
            inputSchema: {
                fileFullPath: z.string().describe('Full path to the file'),
                line: z.number().describe('Line number (1-based)'),
            },
        }, async (args: { fileFullPath: string; line: number }) => {
            const result = await this.debuggingHandler.handleRemoveBreakpoint(args);
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // 清除所有 breakpoints 的 tool。
        this.mcpServer!.registerTool('clear_all_breakpoints', {
            description: 'Clear all breakpoints at once. Use this after verifying the root cause to clean up before moving on to the next task.',
        }, async () => {
            const result = await this.debuggingHandler.handleClearAllBreakpoints();
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // 列出 breakpoints 的 tool。
        this.mcpServer!.registerTool('list_breakpoints', {
            description: 'View all currently set breakpoints across all files.',
        }, async () => {
            const result = await this.debuggingHandler.handleListBreakpoints();
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // 取得 variables 的 tool。
        this.mcpServer!.registerTool('get_variables_values', {
            description: 'Inspect all variable values at the current execution point. This is your window into program state - see what data looks like at runtime, verify assumptions, identify unexpected values, and understand why code behaves as it does.',
            inputSchema: {
                scope: z.enum(['local', 'global', 'all']).optional().describe("Variable scope: 'local', 'global', or 'all'"),
            },
        }, async (args: { scope?: 'local' | 'global' | 'all' }) => {
            const result = await this.debuggingHandler.handleGetVariables(args);
            return { content: [{ type: 'text' as const, text: result }] };
        });

        // 評估 expression 的 tool。
        this.mcpServer!.registerTool('evaluate_expression', {
            description: 'Powerful runtime expression evaluator: Test hypotheses, check computed values, call methods, or inspect object properties in the live debug context. Goes beyond simple variable inspection - evaluate any valid expression in the target language.',
            inputSchema: {
                expression: z.string().describe('Expression to evaluate in the current programming language context'),
            },
        }, async (args: { expression: string }) => {
            const result = await this.debuggingHandler.handleEvaluateExpression(args);
            return { content: [{ type: 'text' as const, text: result }] };
        });
    }

    /**
     * 註冊用來暴露 bundled debugging documentation 的 MCP resources。
     *
     * resources 適合支援 resource reads 的 MCP clients。get_debug_instructions
     * tool 則為只支援 tools 的 clients 鏡像提供主要指南。
     */
    private setupResources() {
        // 新增 debugging documentation 的 MCP resources。
        this.mcpServer!.registerResource('Debugging Instructions Guide', 'debugmcp://docs/debug_instructions', {
            description: 'Step-by-step instructions for debugging with DebugMCP',
            mimeType: 'text/markdown',
        }, async (uri: URL) => {
            const content = await this.loadMarkdownFile('agent-resources/debug_instructions.md');
            return {
                contents: [{
                    uri: uri.href,
                    mimeType: 'text/markdown',
                    text: content,
                }]
            };
        });

        // 新增語言特定 resources。
        const languages = ['python', 'javascript', 'java', 'csharp'];
        const languageTitles: Record<string, string> = {
            'python': 'Python Debugging Tips',
            'javascript': 'JavaScript Debugging Tips',
            'java': 'Java Debugging Tips',
            'csharp': 'C# Debugging Tips'
        };

        languages.forEach(language => {
            this.mcpServer!.registerResource(
                languageTitles[language],
                `debugmcp://docs/troubleshooting/${language}`,
                {
                    description: `Debugging tips specific to ${language}`,
                    mimeType: 'text/markdown',
                },
                async (uri: URL) => {
                    const content = await this.loadMarkdownFile(`agent-resources/troubleshooting/${language}.md`);
                    return {
                        contents: [{
                            uri: uri.href,
                            mimeType: 'text/markdown',
                            text: content,
                        }]
                    };
                }
            );
        });
    }

    /**
     * 從 extension docs 目錄載入 bundled documentation。
     *
     * @param relativePath docs 目錄底下的路徑。
     * @returns Markdown 內容；載入失敗時回傳 error string。
     */
    private async loadMarkdownFile(relativePath: string): Promise<string> {
        try {
            // 取得 extension 安裝目錄。
            const extensionPath = __dirname; // 這會指向編譯後 extension 的目錄。
            const docsPath = path.join(extensionPath, '..', 'docs', relativePath);

            console.log(`Loading markdown file from: ${docsPath}`);

            // 讀取檔案內容。
            const content = await fs.promises.readFile(docsPath, 'utf8');
            console.log(`Successfully loaded ${relativePath}, content length: ${content.length}`);

            return content;
        } catch (error) {
            console.error(`Failed to load ${relativePath}:`, error);
            return `Error loading documentation from ${relativePath}: ${error}`;
        }
    }

    /**
     * 探測設定的 port，避免啟動重複的 HTTP server。
     *
     * @returns 當 localhost 在設定 port 有回應時回傳 true。
     */
    private async isServerRunning(): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const request = http.request({
                hostname: 'localhost',
                port: this.port,
                path: '/',
                method: 'GET',
                timeout: 1000
            }, () => {
                resolve(true); // server 有回應。
            });

            request.on('error', () => {
                resolve(false); // server 未執行。
            });

            request.on('timeout', () => {
                request.destroy();
                resolve(false); // server 無回應。
            });

            request.end();
        });
    }

    /**
     * 啟動承載 MCP endpoint 的本機 HTTP server。
     *
     * 主要 endpoint 是使用 stateless Streamable HTTP 的 POST /mcp。舊版
     * GET /sse endpoint 會為舊 clients 回傳 deprecated response。
     *
     * @throws Error 當 express 或 HTTP server 啟動失敗時丟出。
     */
    async start(): Promise<void> {
        // 先檢查 server 是否已經執行。
        const isRunning = await this.isServerRunning();
        if (isRunning) {
            logger.info(`DebugMCP server is already running on port ${this.port}`);
            return;
        }

        try {
            logger.info(`Starting DebugMCP server on port ${this.port}...`);

            // 動態匯入 express（ES module）。
            const expressModule = await import('express');
            const express = expressModule.default;
            const app = express();

            // 解析 incoming requests 的 JSON body。
            app.use(express.json());

            // Streamable HTTP endpoint，負責處理 MCP protocol messages。
            app.post('/mcp', async (req: any, res: any) => {
                logger.info('New MCP request received');
                
                // 為每個 request 建立新的 transport（stateless mode）。
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: undefined, // stateless mode，不做 session management。
                });

                // response 關閉時清理 transport。
                res.on('close', () => {
                    transport.close();
                    logger.info('MCP transport closed');
                });

                // 將 MCP server 連接到此 transport。
                await this.mcpServer!.connect(transport);
                
                // 處理 incoming request。
                await transport.handleRequest(req, res, req.body);
            });

            // 舊版 SSE endpoint，用於向後相容。
            // 以適當訊息指引使用新的 /mcp endpoint。
            app.get('/sse', async (req: any, res: any) => {
                res.status(410).json({ 
                    error: 'SSE endpoint deprecated', 
                    message: 'Please use POST /mcp endpoint instead',
                    newEndpoint: '/mcp'
                });
            });

            // 啟動 HTTP server。
            await new Promise<void>((resolve, reject) => {
                this.httpServer = app.listen(this.port, () => {
                    resolve();
                });
                this.httpServer.on('error', reject);
            });

            logger.info(`DebugMCP server started successfully on port ${this.port}`);

        } catch (error) {
            logger.error(`Failed to start DebugMCP server`, error);
            throw new Error(`Failed to start DebugMCP server: ${error}`);
        }
    }

    /**
     * 停止本機 HTTP server 並清除追蹤的 transports。
     */
    async stop() {
        // 注意：stateless StreamableHTTPServerTransport 會在每個 request 結束時關閉 transport。
        // 因此不需要手動追蹤並關閉它們。
        this.transports.clear();

        // 關閉 HTTP server。
        if (this.httpServer) {
            await new Promise<void>((resolve) => {
                this.httpServer!.close(() => resolve());
            });
            this.httpServer = null;
        }

        logger.info('DebugMCP server stopped');
    }

    /**
     * 取得 status messages 與 configuration prompts 使用的 base HTTP endpoint。
     *
     * @returns 不含 /mcp path 的 base localhost endpoint。
     */
    getEndpoint(): string {
        return `http://localhost:${this.port}`;
    }

    /**
     * 取得此 server 使用的 debugging handler。
     *
     * @returns handler instance，主要供 tests 使用。
     */
    getDebuggingHandler(): IDebuggingHandler {
        return this.debuggingHandler;
    }

    /**
     * 檢查 initialize() 是否已完成。
     *
     * @returns tools 與 resources 已註冊後回傳 true。
     */
    isInitialized(): boolean {
        return this.initialized;
    }
}
