// Copyright (c) Microsoft Corporation.

// 匯出所有 debugging 相關 classes 與 interfaces。
export { DebugState } from './debugState';
export { DebuggingExecutor, IDebuggingExecutor } from './debuggingExecutor';
export { DebugConfigurationManager as ConfigurationManager, IDebugConfigurationManager as IConfigurationManager } from './utils/debugConfigurationManager';
export { DebuggingHandler, IDebuggingHandler } from './debuggingHandler';

// 匯出 agent configuration classes。
export { AgentConfigurationManager, AgentInfo, MCPServerConfig } from './utils/agentConfigurationManager';
