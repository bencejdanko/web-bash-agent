import OpenAI from 'openai';

export class LlmBridge {
  private openai: OpenAI;
  private model: string;

  constructor(options: any, model: string = 'openai/gpt-4o-mini') {
    this.openai = new OpenAI(options);
    this.model = model;
  }

  getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'bash',
          description: [
            'Run a bash command in the virtual shell environment.',
            'The site content is in /site/. You start in /site/.',
            'All standard bash commands are available: ls, cat, grep, find, head, tail, jq, wc, sort, awk, sed, etc.',
            'Pipes (|), redirections (>, >>), globs (*.json), and chaining (&&, ||) all work.',
            'Use `search "query"` for full-text search across the entire site via Pagefind.',
          ].join(' '),
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The bash command to execute.',
              },
            },
            required: ['command'],
          },
        },
      },
    ];
  }

  getSystemPrompt() {
    return `You are a helpful assistant that explores a website's content through a bash shell.

You have access to a full bash environment. The site's files are available under /site/ (your starting directory).

Quick reference:
- ls, find: discover files and directories
- cat, head, tail: read file contents
- grep -r "term" .: search within files
- jq: parse and query JSON files
- search "query": full-text search across the entire site (powered by Pagefind)

Explore the filesystem to answer user questions. Be concise and helpful.`;
  }

  async *streamChat(messages: any[], options: { reasoning_effort?: 'low' | 'medium' | 'high', include_thinking?: boolean, signal?: AbortSignal } = {}) {
    if (!this.openai?.chat?.completions) {
        throw new Error('OpenAI client not configured');
    }
    const body: any = {
      model: this.model,
      messages: [{ role: 'system', content: this.getSystemPrompt() }, ...messages],
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
    const body: any = {
      model: this.model,
      messages: [{ role: 'system', content: this.getSystemPrompt() }, ...messages],
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
