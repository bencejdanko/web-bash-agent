import { AgentTool } from '../types';

export function createBashTool(customDescription?: string): AgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'bash',
        description: customDescription || [
          'Run a bash command in the virtual shell environment.',
          'THE ONLY WAY TO RUN SHELL COMMANDS IS BY CALLING THIS BASH TOOL.',
          'Standard: ls, cat, grep, find, head, tail, jq, etc. are all available.',
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
    handler: async ({ command }, context?: any) => {
      const sandbox = context?.sandbox || (window as any).bashSandbox;
      if (sandbox) {
        const res = await sandbox.exec(command);
        let out = '';
        if (res.stdout) out += res.stdout;
        if (res.stderr) out += res.stderr;
        return out || '(command completed with no output)';
      }
      return '(error: sandbox unavailable)';
    },
  };
}

export const bashTool = createBashTool();
