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

export interface AgentSidebarProps {
    bashSandbox?: any;
    llmBridge?: any;
    apiKey?: string;
    model?: string;
    filesystem?: Record<string, string>;
    reasoningEffort?: 'low' | 'medium' | 'high';
    includeThinking?: boolean;
    skills?: AgentSkill[];
}

