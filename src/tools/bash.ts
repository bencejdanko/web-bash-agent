import { AgentTool } from '../types/tools';

export function createBashTool(customDescription?: string): AgentTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'bash',
        description: customDescription || [
          'Run a bash command in the virtual shell environment.',
          'The site and its metadata are mounted in `/site/`.',
          'Check `/site/.agents/README.md` for capabilities and usage.',
          'THE ENTIRE SITE IS NOT MOUNTED in /site/. You must use tools.',
          'USE CLI-STYLE BASH COMMANDS ONLY. NO JSON IN THE TERMINAL.',
          'All standard bash commands are available: ls, cat, grep, find, head, tail, jq, wc, sort, awk, sed, etc.',
          'Pipes (|), redirections (>, >>), globs (*.json), and chaining (&&, ||) all work.',
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
    handler: async ({ command }, { bashSandbox }) => {
      const result = await bashSandbox.exec(command);
      let output = '';
      if (result.stdout) output += result.stdout;
      if (result.stderr) output += result.stderr;
      return output || '(no output)';
    },
  };
}

export const bashTool = createBashTool();
