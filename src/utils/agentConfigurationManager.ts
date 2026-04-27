// Copyright (c) Microsoft Corporation.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 描述可接收 DebugMCP 的 AI agent configuration file metadata。
 */
export interface AgentInfo {
    /** 內部使用的穩定 agent identifier。 */
    id: string;
    /** logs 與 errors 中使用的短小寫 agent name。 */
    name: string;
    /** 顯示在 VS Code UI 中的人類可讀 agent name。 */
    displayName: string;
    /** agent MCP configuration file 的絕對路徑。 */
    configPath: string;
    /** 此 agent config shape 中儲存 MCP servers 的 property name。 */
    mcpServerFieldName: string; 
}

/**
 * 寫入支援 AI agent settings files 的 DebugMCP server configuration。
 */
export interface MCPServerConfig {
    /** target agent 支援時自動核准的 tool names。 */
    autoApprove: string[];
    /** 此 MCP server 在 target agent 中是否 disabled。 */
    disabled: boolean;
    /** tool operation timeout，單位為秒。 */
    timeout: number;
    /** target agent 預期的 MCP transport type。 */
    type: string;
    /** 本機 MCP endpoint URL。 */
    url: string;
}

/**
 * 管理 AI agent MCP settings 的 first-run 與 manual configuration。
 *
 * manager 會探索 supported agents 的 platform-specific config paths、寫入
 * DebugMCP server entries，並將較舊的 SSE-style configurations 遷移到目前的
 * Streamable HTTP endpoint。
 */
export class AgentConfigurationManager {
    private context: vscode.ExtensionContext;
    private readonly POPUP_SHOWN_KEY = 'debugmcp.popupShown';
    private readonly timeoutInSeconds: number;
    private readonly serverPort: number;
    

    /**
     * 建立 agent configuration manager。
     *
     * @param context 用於持久化 popup state 的 VS Code extension context。
     * @param timeoutInSeconds 寫入 agent MCP configuration 的 timeout 值。
     * @param serverPort 本機 DebugMCP server port。
     */
    constructor(context: vscode.ExtensionContext, timeoutInSeconds: number, serverPort: number) {
        this.context = context;
        this.timeoutInSeconds = timeoutInSeconds;
        this.serverPort = serverPort;
    }

    /**
     * 檢查是否應顯示 first-run agent configuration popup。
     *
     * @returns popup 尚未標記為已顯示時回傳 true。
     */
    public async shouldShowPopup(): Promise<boolean> {
        // 檢查 popup 是否已顯示過。
        const popupShown = this.context.globalState.get<boolean>(this.POPUP_SHOWN_KEY, false);
        return !popupShown;
    }

    /**
     * 顯示 first-run multi-select agent configuration popup。
     */
    public async showAgentSelectionPopup(): Promise<void> {
        try {
            const agents = await this.getSupportedAgents();

            // 對所有 agents 顯示 selection popup。
            await this.showAgentSelectionDialog(agents);
            
        } catch (error) {
            console.error('Error showing agent selection popup:', error);
            vscode.window.showErrorMessage(`Failed to show agent selection popup: ${error}`);
        }
    }

    /**
     * 重設已持久化的 first-run popup state。
     *
     * 用於測試與手動 debugging onboarding flow。
     */
    public async resetPopupState(): Promise<void> {
        await this.context.globalState.update(this.POPUP_SHOWN_KEY, false);
    }

    /**
     * 從 command palette 顯示單一 agent 的 manual configuration options。
     */
    public async showManualConfiguration(): Promise<void> {
        const agents = await this.getSupportedAgents();

        const items: vscode.QuickPickItem[] = agents.map(agent => ({
            label: agent.displayName,
            description: 'Configure DebugMCP for this agent',
            detail: `Add DebugMCP server configuration to ${agent.displayName}`
        }));

        const selected = await vscode.window.showQuickPick(items, {
            title: 'Configure DebugMCP for AI Agent', 
            placeHolder: 'Select an AI agent to configure with DebugMCP'
        });

        if (selected) {
            const agent = agents.find(a => a.displayName === selected.label);
            if (agent) {
                await this.configureAgent(agent);
            }
        }
    }

    /**
     * 解析 application configuration 的 OS-specific base directory。
     *
     * @returns 用於建立 agent config paths 的 platform-specific config root。
     */
    private getConfigBasePath(): string {
        const platform = os.platform();
        const userHome = os.homedir();
        
        switch (platform) {
            case 'win32': // Windows。
                return process.env.APPDATA || path.join(userHome, 'AppData', 'Roaming');
            case 'darwin': // MacOS。
                return path.join(userHome, 'Library', 'Application Support');
            case 'linux': // Linux。
                return process.env.XDG_CONFIG_HOME || path.join(userHome, '.config');
            default:
                // 未知 platform fallback 到 Windows-style。
                console.warn(`Unknown platform: ${platform}, using Windows config path`);
                return process.env.APPDATA || path.join(userHome, 'AppData', 'Roaming');
        }
    }

    /**
     * 建立 DebugMCP 目前知道如何設定之所有 agents 的 metadata。
     *
     * @returns 具有目前 OS config paths 的 supported agent metadata。
     */
    private async getSupportedAgents(): Promise<AgentInfo[]> {
        const configBasePath = this.getConfigBasePath();
        const platform = os.platform();
        
        console.log(`Detected platform: ${platform}, using config base path: ${configBasePath}`);
        
        const agents: AgentInfo[] = [
            {
                id: 'cline',
                name: 'cline',
                displayName: 'Cline',
                configPath: path.join(configBasePath, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
                mcpServerFieldName: 'mcpServers'
            },
            {
                id: 'copilot',
                name: 'copilot',
                displayName: 'GitHub Copilot',
                configPath: path.join(configBasePath, 'Code', 'User', 'mcp.json'),
                mcpServerFieldName: 'servers'
            },
            {
                id: 'cursor',
                name: 'cursor',
                displayName: 'Cursor',
                configPath: path.join(configBasePath, 'Cursor', 'User', 'globalStorage', 'cursor.mcp', 'settings', 'mcp_settings.json'),
                mcpServerFieldName: 'mcpServers'
            }
        ];

        return agents;
    }

    /**
     * 建立寫入 agent settings 的 DebugMCP MCP server entry。
     *
     * @returns 使用目前 port 與 timeout 的 MCP server configuration。
     */
    private getDebugMCPConfig(): MCPServerConfig {
        return {
            autoApprove: [],
            disabled: false,
            timeout: this.timeoutInSeconds,
            type: "streamableHttp",
            url: `http://localhost:${this.serverPort}/mcp`
        };
    }

    /**
     * 將既有 DebugMCP entries 從 legacy transports 遷移到 streamableHttp。
     *
     * 此流程會在 extension activation 期間執行，並盡可能保留既有 autoApprove
     * settings。
     */
    public async migrateExistingConfigurations(): Promise<void> {
        const agents = await this.getSupportedAgents();
        let migrationCount = 0;

        for (const agent of agents) {
            try {
                if (!fs.existsSync(agent.configPath)) {
                    continue;
                }

                const configContent = await fs.promises.readFile(agent.configPath, 'utf8');
                let config: any;
                
                try {
                    config = JSON.parse(configContent);
                } catch {
                    continue; // 若 config 無法 parse，略過。
                }

                const fieldName = agent.mcpServerFieldName;
                const debugmcpConfig = config[fieldName]?.debugmcp;

                if (!debugmcpConfig) {
                    continue; // 此 agent 尚未設定 DebugMCP。
                }

                // 檢查是否使用舊版 SSE configuration。
                const needsMigration = 
                    debugmcpConfig.type === 'sse' || 
                    debugmcpConfig.type === 'http' ||
                    (debugmcpConfig.url && debugmcpConfig.url.endsWith('/sse'));

                if (needsMigration) {
                    console.log(`Migrating DebugMCP configuration for ${agent.displayName} from SSE to streamableHttp`);
                    
                    // 更新為新的 configuration。
                    config[fieldName].debugmcp = this.getDebugMCPConfig();
                    
                    // 保留任何 custom autoApprove settings。
                    if (debugmcpConfig.autoApprove && Array.isArray(debugmcpConfig.autoApprove)) {
                        config[fieldName].debugmcp.autoApprove = debugmcpConfig.autoApprove;
                    }
                    
                    // 寫入遷移後的 config。
                    await fs.promises.writeFile(
                        agent.configPath,
                        JSON.stringify(config, null, 2),
                        'utf8'
                    );
                    
                    migrationCount++;
                    console.log(`Successfully migrated ${agent.displayName} configuration`);
                }
            } catch (error) {
                console.error(`Error migrating config for ${agent.name}:`, error);
                // 即使單一 agent 失敗，也繼續處理其他 agents。
            }
        }

        if (migrationCount > 0) {
            vscode.window.showInformationMessage(
                `DebugMCP: Migrated ${migrationCount} agent configuration(s) to use the new transport protocol.`
            );
        }
    }

    /**
     * 在 agent configuration file 中新增或更新 DebugMCP server entry。
     *
     * @param agent 包含 config path 與 schema field name 的 agent metadata。
     * @returns config file 成功寫入時回傳 true。
     */
    private async addDebugMCPToAgent(agent: AgentInfo): Promise<boolean> {
        try {
            // 確保 config directory 存在。
            const configDir = path.dirname(agent.configPath);
            if (!fs.existsSync(configDir)) {
                await fs.promises.mkdir(configDir, { recursive: true });
            }

            let config: any = {};
            
            // 若既有 config 存在，先讀取它。
            if (fs.existsSync(agent.configPath)) {
                const configContent = await fs.promises.readFile(agent.configPath, 'utf8');
                try {
                    config = JSON.parse(configContent);
                } catch (parseError) {
                    console.warn(`Failed to parse existing config for ${agent.name}, creating new config`);
                    config = {};
                }
            }

            // 確保此 agent 的正確 MCP servers object 存在。
            const fieldName = agent.mcpServerFieldName;
            if (!config[fieldName]) {
                config[fieldName] = {};
            }

            // 使用目前 settings 新增或更新 DebugMCP configuration。
            config[fieldName].debugmcp = this.getDebugMCPConfig();

            // 將更新後的 config 寫回檔案。
            await fs.promises.writeFile(
                agent.configPath, 
                JSON.stringify(config, null, 2), 
                'utf8'
            );

            console.log(`Successfully added DebugMCP configuration to ${agent.name}`);
            return true;
        } catch (error) {
            console.error(`Error adding DebugMCP to ${agent.name}:`, error);
            vscode.window.showErrorMessage(`Failed to configure DebugMCP for ${agent.displayName}: ${error}`);
            return false;
        }
    }

    /**
     * 顯示 supported agents 的 first-run multi-select QuickPick。
     *
     * @param agents 要顯示在 picker 中的 supported agents。
     */
    private async showAgentSelectionDialog(agents: AgentInfo[]): Promise<void> {
        const items: vscode.QuickPickItem[] = [];

        // 將所有 agents 加入為可選 items。
        agents.forEach(agent => {
            items.push({
                label: `$(add) Configure ${agent.displayName}`,
                description: 'Add DebugMCP server to this agent',
                detail: agent.displayName,
                picked: false
            });
        });


        const quickPick = vscode.window.createQuickPick();
        quickPick.title = 'DebugMCP Setup - Choose AI Agent to Configure';
        quickPick.placeholder = 'Select an AI agent to configure with DebugMCP';
        quickPick.items = items;
        quickPick.canSelectMany = true;
        quickPick.ignoreFocusOut = true;

        quickPick.onDidAccept(async () => {
            const selectedItems = quickPick.selectedItems;
            quickPick.hide();

            // 設定所有已選取 agents。
            for (const selectedItem of selectedItems) {
                if (selectedItem && selectedItem.label.includes('Configure')) {
                    // 使用者選取了一個要設定的 agent。
                    const agentDisplayName = selectedItem.detail;
                    const agent = agents.find(a => a.displayName === agentDisplayName);
                    
                    if (agent) {
                        await this.configureAgent(agent);
                    }
                }
            }
            
            // 使用者互動後，將 popup 標記為已顯示。
            await this.context.globalState.update(this.POPUP_SHOWN_KEY, true);
        });

        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();
    }

    /**
     * 設定特定 agent，並可選擇開啟其 config file。
     *
     * @param agent 使用者選取的 agent metadata。
     */
    private async configureAgent(agent: AgentInfo): Promise<void> {
        try {
            const success = await this.addDebugMCPToAgent(agent);
            
            if (success) {
                // 顯示成功訊息，並提供開啟 config file 的連結。
                const openConfigButton = 'Open Config';
                const result = await vscode.window.showInformationMessage(
                    `✅ DebugMCP successfully configured for ${agent.displayName}`,
                    openConfigButton
                );
                
                if (result === openConfigButton) {
                    // 在 VS Code 中開啟 config file。
                    const configUri = vscode.Uri.file(agent.configPath);
                    await vscode.commands.executeCommand('vscode.open', configUri);
                }
            }
        } catch (error) {
            console.error(`Error configuring ${agent.name}:`, error);
            vscode.window.showErrorMessage(`Failed to configure ${agent.displayName}: ${error}`);
        }
    }
}
