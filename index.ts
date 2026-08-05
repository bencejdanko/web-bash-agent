export { agent } from './src/agent';
export type { AgentOptions, AgentResult, ToolCallRecord } from './src/agent';

export { PersistentBashSandbox as BashSandbox } from './src/PersistentBashSandbox';
export { LlmBridge } from './src/llmBridge';
export { getFilesystem, getAgentContextFilesystem } from './src/filesystem';
export { bashTool } from './src/tools/bash';
export { createPythonCommand } from './src/commands/python';
export { createNotepadCommand, createEditCommand, openNotepadModal, MinimalNotepadModal } from './src/commands/notepad';
export { createExplorerCommand, createFilesCommand, MinimalExplorerModal } from './src/commands/explorer';
export { MinimalWindowModal } from './src/commands/windowModal';

export type { Message, ToolConfig, ModelConfig } from './src/types';
export type { PersistentBashOptions as BashSandboxOptions, ExecResult } from './src/PersistentBashSandbox';
