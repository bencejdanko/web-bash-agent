
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export type ToolHandler = (args: any, context: { 
  bashSandbox: any; 
  llmBridge: any;
  iterationId?: string;
  toolCallId?: string;
}) => Promise<string>;

export interface AgentTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}
