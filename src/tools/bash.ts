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
          'Do NOT try to call "ls", "cat", "grep", etc. as separate tools; they do not exist.',
          'Instead, pass your command string to this tool, e.g., bash({ command: "ls -R /site" }).',
          'The site and its metadata are mounted in `/site/`.',
          'Check `/site/.agents/README.md` for capabilities and usage.',
          'All standard bash commands are available INSIDE the bash tool: ls, cat, grep, find, head, tail, jq, wc, sort, awk, sed, etc.',
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
