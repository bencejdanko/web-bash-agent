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
          name: 'run_terminal_command',
          description: 'Run a terminal command to explore the Virtual Bash Filesystem of the site.',
          parameters: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The bash command to run (e.g. ls /api, grep "keyword" /api/*, cat /api/file.json)',
              },
            },
            required: ['command'],
          },
        },
      },
    ];
  }

  getSystemPrompt() {
    return `You are an agentic assistant exploring a local Virtual Bash Filesystem of this website. 
You can use standard bash commands like 'ls', 'grep', and 'cat' to explore the content.
- Use 'ls' to see directories and files.
- Use 'grep -i "query" /api/*' to search across all content indexed by Pagefind.
- Use 'cat /api/path.json' to fetch the raw JSON/markdown body of a page.
All interactions are read-only-read. Standard bash errors (e.g. command not found) apply.`;
  }

  async chat(messages: any[]) {
    if (!this.openai?.chat?.completions) {
        throw new Error('OpenAI client not configured');
    }
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [{ role: 'system', content: this.getSystemPrompt() }, ...messages],
      tools: this.getToolDefinitions() as any,
      tool_choice: 'auto',
    });
    return response.choices[0];
  }
}
