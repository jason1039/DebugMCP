// Copyright (c) Microsoft Corporation.

import * as vscode from 'vscode';
import { DebugMCPServer } from './debugMCPServer';
import { AgentConfigurationManager } from './utils/agentConfigurationManager';
import { logger, LogLevel } from './utils/logger';

let mcpServer: DebugMCPServer | null = null;
let agentConfigManager: AgentConfigurationManager | null = null;

/**
 * VS Code extension 的啟用入口。
 *
 * 初始化 logging、讀取 DebugMCP 設定、遷移既有 agent MCP 設定、
 * 啟動內嵌 MCP server、註冊 command palette 命令，並安排第一次啟動時的
 * agent 設定提示。
 *
 * @param context VS Code extension context，用於 subscriptions 與 global state。
 */
export async function activate(context: vscode.ExtensionContext) {
    // 優先初始化 logging。
    logger.info('DebugMCP extension is now active!');
    logger.logSystemInfo();
    logger.logEnvironment();

    const config = vscode.workspace.getConfiguration('debugmcp');
    const timeoutInSeconds = config.get<number>('timeoutInSeconds', 180);
    const serverPort = config.get<number>('serverPort', 3001);

    logger.info(`Using timeoutInSeconds: ${timeoutInSeconds} seconds`);
    logger.info(`Using serverPort: ${serverPort}`);

    // 初始化 Agent Configuration Manager。
    agentConfigManager = new AgentConfigurationManager(context, timeoutInSeconds, serverPort);

    // 將既有 SSE 設定遷移到 streamableHttp，以維持向後相容。
    try {
        await agentConfigManager.migrateExistingConfigurations();
    } catch (error) {
        logger.error('Error migrating existing configurations', error);
    }

    // 初始化 MCP Server。
    try {
        logger.info('Starting MCP server initialization...');
        
        mcpServer = new DebugMCPServer(serverPort, timeoutInSeconds);
        await mcpServer.initialize();
        await mcpServer.start();
        
        const endpoint = mcpServer.getEndpoint();
        logger.info(`DebugMCP server running at: ${endpoint}`);
        vscode.window.showInformationMessage(`DebugMCP server running on ${endpoint}`);
    } catch (error) {
        logger.error('Failed to initialize MCP server', error);
        vscode.window.showErrorMessage(`Failed to initialize MCP server: ${error}`);
    }

    // 註冊命令。
    registerCommands(context);

    // 如有需要，稍微延遲後顯示安裝後提示，讓 VS Code 有時間完成載入。
    setTimeout(async () => {
        try {
            if (agentConfigManager && await agentConfigManager.shouldShowPopup()) {
                await agentConfigManager.showAgentSelectionPopup();
            }
        } catch (error) {
            logger.error('Error showing post-install popup', error);
        }
    }, 2000);

    logger.info('DebugMCP extension activated successfully');
}

/**
 * 註冊此 extension 擁有的 command palette 命令。
 *
 * 這些命令只是進入 AgentConfigurationManager 的薄 UI 入口，不負責啟停
 * MCP server；server 生命週期仍由 activation/deactivation 控制。
 *
 * @param context 擁有 command disposables 的 VS Code extension context。
 */
function registerCommands(context: vscode.ExtensionContext) {
    // 手動為 agents 設定 DebugMCP 的命令。
    const configureAgentsCommand = vscode.commands.registerCommand(
        'debugmcp.configureAgents',
        async () => {
            if (agentConfigManager) {
                await agentConfigManager.showManualConfiguration();
            }
        }
    );

    // 再次顯示 agent 選擇提示的命令。
    const showPopupCommand = vscode.commands.registerCommand(
        'debugmcp.showAgentSelectionPopup',
        async () => {
            if (agentConfigManager) {
                await agentConfigManager.showAgentSelectionPopup();
            }
        }
    );

    // 重設提示狀態的命令，用於開發與測試。
    const resetPopupCommand = vscode.commands.registerCommand(
        'debugmcp.resetPopupState',
        async () => {
            if (agentConfigManager) {
                await agentConfigManager.resetPopupState();
                vscode.window.showInformationMessage('DebugMCP popup state has been reset.');
            }
        }
    );

    context.subscriptions.push(
        configureAgentsCommand,
        showPopupCommand,
        resetPopupCommand
        );
}

/**
 * VS Code extension 的停用入口。
 *
 * VS Code 卸載 extension 時停止內嵌 MCP server。停止失敗只會記錄 log，
 * 不會重新丟出，因為停用流程應保持 best-effort。
 */
export async function deactivate() {
    logger.info('DebugMCP extension deactivating...');
    
    // 清理 MCP server。
    if (mcpServer) {
        mcpServer.stop().catch(error => {
            logger.error('Error stopping MCP server', error);
        });
        mcpServer = null;
    }
    
    logger.info('DebugMCP extension deactivated');
}
