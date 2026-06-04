import OpenAI from 'openai';
import { AgentInjection } from './types';

export class LlmBridge {
  private openai: OpenAI;
  private model: string;
  private turnstileToken: string | null = null;

  private systemPromptOverride: string | null = null;

  public tools: any[] = []; // Can hold full AgentTool objects

  setTurnstileToken(token: string | null) {
    this.turnstileToken = token;
  }

  private createOpenAI(config: { apiKey: string; baseURL?: string; dangerouslyAllowBrowser?: boolean; defaultHeaders?: Record<string, string> }) {
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      dangerouslyAllowBrowser: config.dangerouslyAllowBrowser,
      defaultHeaders: config.defaultHeaders,
      fetch: async (url, init) => {
        const headers = new Headers(init?.headers);
        const sessionToken = localStorage.getItem('agent-session-token');
        if (sessionToken) {
          headers.set('X-Session-Token', sessionToken);
        }
        if (this.turnstileToken) {
          headers.set('X-Turnstile-Token', this.turnstileToken);
          this.turnstileToken = null; // consume token
        }
        const response = await fetch(url, {
          ...init,
          headers
        });
        const newSessionToken = response.headers.get('X-Session-Token');
        if (newSessionToken) {
          localStorage.setItem('agent-session-token', newSessionToken);
        }
        return response;
      }
    });
  }

  constructor(options: { 
    apiKey: string; 
    baseURL?: string; 
    dangerouslyAllowBrowser?: boolean;
    model: string;
    systemPrompt: string;
    tools?: any[];
    defaultHeaders?: Record<string, string>;
  }) {
    this.openai = this.createOpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      dangerouslyAllowBrowser: options.dangerouslyAllowBrowser,
      defaultHeaders: options.defaultHeaders,
    });
    this.model = options.model;
    this.systemPromptOverride = options.systemPrompt;
    this.tools = options.tools || [];
  }

  updateConfig(config: { apiKey: string; endpoint: string; model: string; defaultHeaders?: Record<string, string> }) {
    this.openai = this.createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
      dangerouslyAllowBrowser: true,
      defaultHeaders: config.defaultHeaders,
    });
    this.model = config.model;
  }

  setModel(model: string) {
    this.model = model;
  }

  setTools(tools: any[]) {
    this.tools = tools;
  }

  setSystemPrompt(prompt: string) {
    this.systemPromptOverride = prompt;
  }

  getToolDefinitions() {
    // OpenAI ONLY wants the definition part.
    return this.tools.map(t => t.definition || t);
  }

  getSystemPrompt() {
    return this.systemPromptOverride || '';
  }

  async *streamChat(messages: any[], options: { reasoning_effort?: 'low' | 'medium' | 'high', include_thinking?: boolean, signal?: AbortSignal } = {}) {
    if (!this.openai?.chat?.completions) {
        throw new Error('OpenAI client not configured');
    }
    const systemPrompt = this.getSystemPrompt();
    const body: any = {
      model: this.model,
      messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages,
      tools: this.getToolDefinitions() as any,
      tool_choice: 'auto',
      stream: true,
    };

    if (options.reasoning_effort && (this.model.includes('o1') || this.model.includes('o3-mini'))) {
      body.reasoning_effort = options.reasoning_effort;
    }
    
    if (options.include_thinking) {
      body.include_thinking = true;
    }

    const stream = await this.openai.chat.completions.create(body, { signal: options.signal }) as any;
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  async chat(messages: any[], options: { reasoning_effort?: 'low' | 'medium' | 'high', include_thinking?: boolean, signal?: AbortSignal } = {}) {
    if (!this.openai?.chat?.completions) {
        throw new Error('OpenAI client not configured');
    }
    const systemPrompt = this.getSystemPrompt();
    const body: any = {
      model: this.model,
      messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages,
      tools: this.getToolDefinitions() as any,
      tool_choice: 'auto',
    };

    if (options.reasoning_effort && (this.model.includes('o1') || this.model.includes('o3-mini'))) {
      body.reasoning_effort = options.reasoning_effort;
    }
    
    if (options.include_thinking) {
      body.include_thinking = true;
    }

    const response = await this.openai.chat.completions.create(body, { signal: options.signal });
    return response.choices[0];
  }
}

