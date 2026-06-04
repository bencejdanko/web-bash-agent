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

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentInjection {
    type: 'system' | 'skill';
    name: string;
    description: string;
    instructions: string;
    path: string;
    metadata?: Record<string, string>;
}

// Keep alias for backward compatibility during transition if needed
export type AgentSkill = AgentInjection;

export interface AgentProfile {
    id: string;
    name: string;
    systemPromptPath: string;
    description?: string;
    skillsDir?: string;
}

export type ToolConfig = 
    | { type: 'bash' }
    | { type: 'load-skill' }
    | { type: 'mcp'; serverUrl: string }
    | { type: string; [key: string]: any } // Generic serializable config
    | any; // Allow passing full AgentTool object directly (client-side)

export type BashCommandConfig =
    | { type: 'mcp'; serverUrl: string; toolName: string }
    | { type: string; [key: string]: any } // Generic serializable config
    | any; // Allow passing full Command object directly (client-side)


export interface ModelConfig {
    id: string;
    name: string;
    endpoint: string;
    apiKey?: string;
    keyIdentifier?: string;
    routerUrl?: string;
}

export interface AgentSidebarProps {
    bashSandbox?: any;
    llmBridge?: any;
    
    models: ModelConfig[];
    initialModelId?: string;

    filesystem?: Record<string, string>;
    reasoningEffort?: 'low' | 'medium' | 'high';

    includeThinking?: boolean;
    injections?: AgentInjection[];
    customBashCommands?: (ctx: { pagefind: any, getFs: () => any }) => any[];
    turnstileSiteKey?: string;
}
