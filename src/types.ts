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

export interface AgentInjection {
    type: 'system' | 'skill';
    name: string;
    description: string;
    instructions: string;
    path: string;
    metadata?: Record<string, string>;
}

export type AgentSkill = AgentInjection;

export type ToolConfig = 
    | { type: 'bash' }
    | { type: 'load-skill' }
    | { type: 'mcp'; serverUrl: string }
    | { type: string; [key: string]: any };

export interface ModelConfig {
    id: string;
    name: string;
    endpoint: string;
    apiKey?: string;
    keyIdentifier?: string;
    routerUrl?: string;
}
