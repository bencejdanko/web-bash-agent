export { AgentSidebar } from './src/vanilla/components/AgentSidebar';
export { PersistentBashSandbox as BashSandbox } from './src/vanilla/PersistentBashSandbox';
export { LlmBridge } from './src/llmBridge';
export { getFilesystem, getAgentContextFilesystem } from './src/filesystem';
export { bashTool } from './src/tools/bash';
export { createPythonCommand } from './src/commands/python';
export { createNotepadCommand, createEditCommand, openNotepadModal, MinimalNotepadModal } from './src/commands/notepad';
export { createExplorerCommand, createFilesCommand, MinimalExplorerModal } from './src/commands/explorer';
export { MinimalWindowModal } from './src/commands/windowModal';

export type { Message, AgentSidebarProps, ToolConfig, ModelConfig } from './src/types';
export type { PersistentBashOptions as BashSandboxOptions, ExecResult } from './src/vanilla/PersistentBashSandbox';
