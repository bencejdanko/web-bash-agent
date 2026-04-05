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

export interface AgentSkill {
    name: string;
    description: string;
    instructions: string; // The body content after frontmatter
    path: string; // Path to the skill directory relative to /site/
    metadata?: Record<string, string>;
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

    systemPrompt: string;
    filesystem?: Record<string, string>;
    reasoningEffort?: 'low' | 'medium' | 'high';

    includeThinking?: boolean;
    skills?: AgentSkill[];
    // Can be explicit BashCommandConfig objects (serializable) OR full Command objects (client-side)
    customBashCommands?: (BashCommandConfig | any)[];
}


