// Copyright (c) Microsoft Corporation.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * debugging handler 使用的 debug configuration resolution contract。
 *
 * 實作負責選擇既有 launch.json configuration，或依 target file 建立
 * best-effort default configuration。
 */
export interface IDebugConfigurationManager {
    /** 解析用於啟動 session 的 debug configuration。 */
    getDebugConfig(
        workingDirectory: string, 
        fileFullPath: string, 
        configurationName?: string,
        testName?: string
    ): Promise<vscode.DebugConfiguration>;
    /** 詢問使用者要使用哪個 configuration。 */
    promptForConfiguration(workingDirectory: string): Promise<string | undefined>;
    /** 從 source file path 推斷 VS Code debug type。 */
    detectLanguageFromFilePath(fileFullPath: string): string;
}

/**
 * 為 DebugMCP sessions 解析 VS Code debug configurations。
 *
 * manager 會優先使用明確的 launch.json configurations；若不可用，則依
 * file extension fallback 到產生的 defaults。它也包含常見語言的
 * test-specific heuristics。
 */
export class DebugConfigurationManager implements IDebugConfigurationManager {
    private static readonly AUTO_LAUNCH_CONFIG = 'Default Configuration';

    /**
     * 取得 target file 的既有或產生式 debug configuration。
     *
     * 如果 named launch configuration 存在，會以 DebugMCP display name 回傳。
     * 否則會產生 language-specific default。
     *
     * @param workingDirectory 可能包含 .vscode/launch.json 的 workspace directory。
     * @param fileFullPath 要 debug 的 target source file。
     * @param configurationName 使用者或 caller 選擇的 optional launch configuration name。
     * @param testName 用於 test-debug mode 的 optional test method/name。
     * @returns VS Code debug configuration。
     */
    public async getDebugConfig(
        workingDirectory: string,
        fileFullPath: string,
        configurationName?: string,
        testName?: string
    ): Promise<vscode.DebugConfiguration> {
        if (configurationName === DebugConfigurationManager.AUTO_LAUNCH_CONFIG) {
            return this.createDefaultDebugConfig(fileFullPath, workingDirectory, testName);
        }

        try {
            // 在 .vscode folder 中尋找 launch.json。
            const launchJsonPath = vscode.Uri.joinPath(vscode.Uri.file(workingDirectory), '.vscode', 'launch.json');
            const launchJsonDoc = await vscode.workspace.openTextDocument(launchJsonPath);
            const launchJsonContent = launchJsonDoc.getText();
            
            // 解析 JSON，先移除 comments 與 trailing commas。
            let cleanJson = launchJsonContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
            // 移除 closing brackets/braces 前的 trailing commas。
            cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1');
            const launchConfig = JSON.parse(cleanJson);
            
            if (launchConfig.configurations && Array.isArray(launchConfig.configurations) && launchConfig.configurations.length > 0) {
                // 若提供特定 configuration name，則尋找該設定。
                if (configurationName) {
                    const namedConfig = launchConfig.configurations.find((config: any) => 
                        config.name === configurationName
                    );
                    if (namedConfig) {
                        return {
                            ...namedConfig,
                            name: `DebugMCP Launch (${configurationName})`
                        };
                    }
                    console.log(`No configuration named '${configurationName}' found in launch.json`);
                }
            }
        } catch (launchJsonError) {
            console.log('Could not read or parse launch.json:', launchJsonError);
        }

        // fallback：若沒有其他匹配，一律回傳 default configuration。
        return this.createDefaultDebugConfig(fileFullPath, workingDirectory, testName);
    }

    /**
     * 提示使用者選擇 launch configuration 或 default generator。
     *
     * @param workingDirectory 可能包含 .vscode/launch.json 的 workspace directory。
     * @returns 已選取的 configuration label。
     * @throws Error 當使用者取消 picker 或 picker 無法顯示時丟出。
     */
    public async promptForConfiguration(workingDirectory: string): Promise<string | undefined> {
        try {
            // 在 .vscode folder 中尋找 launch.json。
            const launchJsonPath = vscode.Uri.joinPath(vscode.Uri.file(workingDirectory), '.vscode', 'launch.json');
            
            let configurations: any[] = [];
            
            try {
                const launchJsonDoc = await vscode.workspace.openTextDocument(launchJsonPath);
                const launchJsonContent = launchJsonDoc.getText();
                
                // 解析 JSON，先移除 comments 與 trailing commas。
                let cleanJson = launchJsonContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
                // 移除 closing brackets/braces 前的 trailing commas。
                cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1');
                const launchConfig = JSON.parse(cleanJson);
                
                if (launchConfig.configurations && Array.isArray(launchConfig.configurations)) {
                    configurations = launchConfig.configurations;
                }
            } catch (launchJsonError) {
                console.log('Could not read or parse launch.json:', launchJsonError);
            }
            
            // 現在一律顯示 popup，即使沒有任何 configurations。
            const configOptions: vscode.QuickPickItem[] = [];
            
            // 如有既有 configurations，加入選項。
            if (configurations.length > 0) {
                configOptions.push(...configurations.map(config => ({
                    label: config.name || 'Unnamed Configuration',
                    description: config.type ? `Type: ${config.type}` : '',
                    detail: config.request ? `Request: ${config.request}` : ''
                })));
            }
            
            // 將 AUTO_LAUNCH_CONFIG 加在最後。
            configOptions.push({
                label: DebugConfigurationManager.AUTO_LAUNCH_CONFIG,
                description: 'Use auto-detected default configuration (beta)',
                detail: 'DebugMCP will create a default configuration based on file extension. This is a heuristic and may not always work as expected.'
            });
            
            // 對使用者顯示 quick pick。
            const selected = await vscode.window.showQuickPick(configOptions, {
                placeHolder: 'Select a debug configuration to use',
                title: 'Choose Debug Configuration'
            });
            
            if (!selected) {
                // 使用者取消選擇。
                throw new Error('Debug configuration selection cancelled by user');
            }
                        
            return selected.label;
        } catch (error) {
            console.log('Error prompting for configuration:', error);
            throw error;
        }
    }

    /**
     * 從 source file extension 推斷 VS Code debug type。
     *
     * @param fileFullPath target source file path。
     * @returns debug adapter type string；未知副檔名預設為 python。
     */
    public detectLanguageFromFilePath(fileFullPath: string): string {
        const extension = path.extname(fileFullPath).toLowerCase();
        
        const languageMap: { [key: string]: string } = {
            '.py': 'python',
            '.js': 'node',
            '.ts': 'node',
            '.jsx': 'node',
            '.tsx': 'node',
            '.java': 'java',
            '.cs': 'coreclr',
            '.cpp': 'cppdbg',
            '.cc': 'cppdbg',
            '.c': 'cppdbg',
            '.go': 'go',
            '.rs': 'lldb',
            '.php': 'php',
            '.rb': 'ruby'
        };

        return languageMap[extension] || 'python'; // 未知時預設為 python。
    }

    /**
     * 為 target file 建立 best-effort debug configuration。
     *
     * @param fileFullPath 要 debug 的 target source file。
     * @param workingDirectory caller 提供的 workspace directory。
     * @param testName 觸發 test-specific config generation 的 optional test name。
     * @returns 產生的 VS Code debug configuration。
     */
    private async createDefaultDebugConfig(
        fileFullPath: string, 
        workingDirectory: string,
        testName?: string
    ): Promise<vscode.DebugConfiguration> {
        const detectedLanguage = this.detectLanguageFromFilePath(fileFullPath);
        const cwd = path.dirname(fileFullPath);
        
        // 依語言建立 test-specific configurations。
        if (testName && detectedLanguage !== 'coreclr') {
            return await this.createTestDebugConfig(detectedLanguage, fileFullPath, cwd, testName);
        }

        const configs: { [key: string]: vscode.DebugConfiguration } = {
            python: {
                type: 'python',
                request: 'launch',
                name: 'DebugMCP Python Launch',
                program: fileFullPath,
                console: 'integratedTerminal',
                cwd: cwd,
                env: {},
                stopOnEntry: false
            },
            node: {
                type: 'pwa-node',
                request: 'launch',
                name: 'DebugMCP Node.js Launch',
                program: fileFullPath,
                console: 'integratedTerminal',
                cwd: cwd,
                env: {},
                stopOnEntry: false
            },
            java: {
                type: 'java',
                request: 'launch',
                name: 'DebugMCP Java Launch',
                mainClass: path.basename(fileFullPath, path.extname(fileFullPath)),
                console: 'integratedTerminal',
                cwd: cwd
            },
            coreclr: {
                type: 'coreclr',
                request: 'launch',
                name: 'DebugMCP .NET Launch',
                program: fileFullPath,
                console: 'integratedTerminal',
                cwd: cwd,
                stopAtEntry: false
            },
            cppdbg: {
                type: 'cppdbg',
                request: 'launch',
                name: 'DebugMCP C++ Launch',
                program: fileFullPath.replace(/\.(cpp|cc|c)$/, '.exe'),
                cwd: cwd,
                console: 'integratedTerminal'
            },
            go: {
                type: 'go',
                request: 'launch',
                name: 'DebugMCP Go Launch',
                mode: 'debug',
                program: fileFullPath,
                cwd: cwd
            }
        };

        return configs[detectedLanguage] || configs.python; // 未知時 fallback 到 Python。
    }

    /**
     * 驗證 debug configuration 所需的最小 workspace shape。
     *
     * @param workspaceFolder 要驗證的 VS Code workspace folder。
     * @returns 當 workspace folder 有可用 filesystem path 時回傳 true。
     */
    public validateWorkspace(workspaceFolder: vscode.WorkspaceFolder): boolean {
        try {
            // 基本驗證：workspace folder 存在。
            return workspaceFolder && workspaceFolder.uri && workspaceFolder.uri.fsPath.length > 0;
        } catch (error) {
            console.log('Workspace validation error:', error);
            return false;
        }
    }

    /**
     * 從 workspace launch.json 讀取可用 configuration names。
     *
     * @param workspaceFolder 包含 .vscode/launch.json 的 workspace folder。
     * @returns configuration names；無法讀取時回傳空陣列。
     */
    public async getAvailableConfigurations(workspaceFolder: vscode.WorkspaceFolder): Promise<string[]> {
        try {
            const launchJsonPath = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'launch.json');
            const launchJsonDoc = await vscode.workspace.openTextDocument(launchJsonPath);
            const launchJsonContent = launchJsonDoc.getText();
            
            // 解析 JSON，先移除 comments 與 trailing commas。
            let cleanJson = launchJsonContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
            // 移除 closing brackets/braces 前的 trailing commas。
            cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1');
            const launchConfig = JSON.parse(cleanJson);
            
            if (launchConfig.configurations && Array.isArray(launchConfig.configurations)) {
                return launchConfig.configurations.map((config: any) => config.name || 'Unnamed Configuration');
            }
            
            return [];
        } catch (error) {
            console.log('Could not read available configurations:', error);
            return [];
        }
    }

    /**
     * 檢查 workspace 是否包含可讀取的 launch.json file。
     *
     * @param workspaceFolder 要檢查的 workspace folder。
     * @returns 當 .vscode/launch.json 可以開啟時回傳 true。
     */
    public async hasLaunchJson(workspaceFolder: vscode.WorkspaceFolder): Promise<boolean> {
        try {
            const launchJsonPath = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'launch.json');
            await vscode.workspace.openTextDocument(launchJsonPath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 從 Python test file 擷取第一個可能的 class name。
     *
     * 此 helper 支援 unittest-style test targets，並假設是簡單的一檔一個 test
     * class pattern。
     *
     * @param fileFullPath Python source file path。
     * @returns class name；無法偵測時為 null。
     */
    private async extractPythonClassName(fileFullPath: string): Promise<string | null> {
        try {
            const content = await fs.promises.readFile(fileFullPath, 'utf8');
            // 比對 Python class definition：class ClassName 或 class ClassName(BaseClass)。
            // 尋找大寫字母開頭的 classes，test classes 通常遵循此 pattern。
            const classMatch = content.match(/class\s+([A-Z][a-zA-Z0-9_]*)/);
            return classMatch ? classMatch[1] : null;
        } catch (error) {
            console.log('Error extracting class name from Python file:', error);
            return null;
        }
    }

    /**
     * 為 class-based 或 function tests 格式化 Python unittest target。
     *
     * @param fileFullPath Python test file path。
     * @param testName caller 提供的 test method 或 ClassName.method。
     * @returns unittest-compatible target string。
     */
    private async formatPythonTestName(fileFullPath: string, testName: string): Promise<string> {
        const moduleName = path.basename(fileFullPath, '.py');
        
        // 若 testName 已包含 dot，假設它是 ClassName.method 格式。
        if (testName.includes('.')) {
            return `${moduleName}.${testName}`;
        }
        
        // 否則嘗試從檔案擷取 class name。
        const className = await this.extractPythonClassName(fileFullPath);
        if (className) {
            // 找到 class，格式化為 module.ClassName.testMethod。
            return `${moduleName}.${className}.${testName}`;
        }
        
        // 找不到 class，假設它是 standalone test function。
        return `${moduleName}.${testName}`;
    }

    /**
     * 為支援語言建立 test-focused debug configuration。
     *
     * @param language 從 file path 推斷出的 debug adapter type。
     * @param fileFullPath test source file path。
     * @param cwd debug adapter 使用的 working directory。
     * @param testName caller 要求的 test name 或 pattern。
     * @returns 支援時用於 targeted test run 的 VS Code debug configuration。
     */
    private async createTestDebugConfig(
        language: string,
        fileFullPath: string,
        cwd: string,
        testName: string
    ): Promise<vscode.DebugConfiguration> {
        const fileName = path.basename(fileFullPath);

        switch (language) {
            case 'python':
                // 自動偵測 class name，並適當格式化 test name。
                const formattedTestName = await this.formatPythonTestName(fileFullPath, testName);
                
                return {
                    type: 'python',
                    request: 'launch',
                    name: `DebugMCP Python Test: ${testName}`,
                    module: 'unittest',
                    args: [
                        formattedTestName,
                        '-v'
                    ],
                    console: 'integratedTerminal',
                    cwd: cwd,
                    env: {},
                    stopOnEntry: false,
                    justMyCode: false,
                    purpose: ['debug-test']
                };

            case 'node':
                // 支援 Jest、Mocha 與其他 Node.js test frameworks。
                // 嘗試依 common patterns 偵測 test framework。
                const isJest = fileName.includes('.test.') || fileName.includes('.spec.');
                
                if (isJest) {
                    // Jest configuration。
                    return {
                        type: 'pwa-node',
                        request: 'launch',
                        name: `DebugMCP Jest Test: ${testName}`,
                        program: '${workspaceFolder}/node_modules/.bin/jest',
                        args: [
                            '--testNamePattern', testName,
                            '--runInBand',
                            fileFullPath
                        ],
                        console: 'integratedTerminal',
                        cwd: cwd,
                        env: {},
                        stopOnEntry: false
                    };
                } else {
                    // Mocha configuration。
                    return {
                        type: 'pwa-node',
                        request: 'launch',
                        name: `DebugMCP Mocha Test: ${testName}`,
                        program: '${workspaceFolder}/node_modules/.bin/mocha',
                        args: [
                            '--grep', testName,
                            fileFullPath
                        ],
                        console: 'integratedTerminal',
                        cwd: cwd,
                        env: {},
                        stopOnEntry: false
                    };
                }

            case 'java':
                // JUnit test configuration。
                const className = path.basename(fileFullPath, path.extname(fileFullPath));
                return {
                    type: 'java',
                    request: 'launch',
                    name: `DebugMCP JUnit Test: ${testName}`,
                    mainClass: className,
                    args: ['--tests', `${className}.${testName}`],
                    console: 'integratedTerminal',
                    cwd: cwd
                };

            case 'coreclr':
                // .NET test configuration，支援 xUnit、NUnit、MSTest。
                return {
                    type: 'coreclr',
                    request: 'launch',
                    name: `DebugMCP .NET Test: ${testName}`,
                    program: 'dotnet',
                    args: [
                        'test',
                        '--filter', `FullyQualifiedName~${testName}`,
                        '--no-build'
                    ],
                    console: 'integratedTerminal',
                    cwd: cwd,
                    stopAtEntry: false
                };

            default:
                // 不支援的語言 fallback 為執行整個檔案，
                // 但在名稱中包含 warning。
                return {
                    type: language,
                    request: 'launch',
                    name: `DebugMCP Launch (test filtering not supported for ${language})`,
                    program: fileFullPath,
                    console: 'integratedTerminal',
                    cwd: cwd,
                    stopOnEntry: false
                };
        }
    }

    /**
     * 取得 generated default configuration 使用的 QuickPick label。
     *
     * @returns auto-launch configuration label。
     */
    public static getAutoLaunchConfigName(): string {
        return DebugConfigurationManager.AUTO_LAUNCH_CONFIG;
    }
}
