export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export type ToolHandler = (args: any, context?: any) => Promise<string>;

export interface AgentTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
  reasoning_content?: string;
  iterationId?: string;
  thinkingTime?: number;
  turnId?: string;
  turnDuration?: number;
  isPending?: boolean;
  startTime?: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  endpoint: string;
  apiKey?: string;
  keyIdentifier?: string;
  routerUrl?: string;
}
