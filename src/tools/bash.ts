import { AgentTool } from '../types/tools';

export function createBashTool(customDescription?: string): AgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'bash',
        description: customDescription || [
          'Run a bash command in the virtual shell environment.',
          'THE ONLY WAY TO RUN SHELL COMMANDS IS BY CALLING THIS BASH TOOL.',
          'Specialized: `search "query"`, `navigate "/url"`, `fetch_internal "/path"`.',
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
    handler: async ({ command }, { iterationId, toolCallId }) => {
      const manager = (window as any).terminalSessionManager;
      if (manager && iterationId && toolCallId) {
        const sessionId = `${iterationId}-${toolCallId}`;
        return await manager.runCommand(sessionId, command);
      }
      
      // Fallback if manager is missing (unlikely in this architecture)
      return '(error: session manager unavailable)';
    },
  };
}

export const bashTool = createBashTool();
