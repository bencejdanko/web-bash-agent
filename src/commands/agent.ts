import { defineCommand } from 'just-bash/browser';
import { agent, AgentOptions } from '../agent';

export const CONFIG_STORAGE_KEY_ENDPOINT = 'pugilister_agent_endpoint';
export const CONFIG_STORAGE_KEY_API_KEY = 'pugilister_agent_api_key';

export interface AgentConfig {
  endpoint?: string;
  apiKey?: string;
}

/**
 * Retrieves the stored agent configuration from localStorage.
 */
export function getStoredAgentConfig(): AgentConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  const endpoint = window.localStorage.getItem(CONFIG_STORAGE_KEY_ENDPOINT) || undefined;
  const apiKey = window.localStorage.getItem(CONFIG_STORAGE_KEY_API_KEY) || undefined;
  return { endpoint, apiKey };
}

/**
 * Saves or updates agent configuration in localStorage.
 */
export function setStoredAgentConfig(config: AgentConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  if (config.endpoint !== undefined) {
    if (config.endpoint) {
      window.localStorage.setItem(CONFIG_STORAGE_KEY_ENDPOINT, config.endpoint);
    } else {
      window.localStorage.removeItem(CONFIG_STORAGE_KEY_ENDPOINT);
    }
  }

  if (config.apiKey !== undefined) {
    if (config.apiKey) {
      window.localStorage.setItem(CONFIG_STORAGE_KEY_API_KEY, config.apiKey);
    } else {
      window.localStorage.removeItem(CONFIG_STORAGE_KEY_API_KEY);
    }
  }
}

/**
 * Clears stored agent configuration from localStorage.
 */
export function clearStoredAgentConfig(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem(CONFIG_STORAGE_KEY_ENDPOINT);
  window.localStorage.removeItem(CONFIG_STORAGE_KEY_API_KEY);
}

function maskApiKey(key?: string): string {
  if (!key) return '(not set)';
  if (key.length <= 8) return '********';
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}

/**
 * Creates a just-bash custom command for `agent`.
 * Usage:
 *   agent configure
 *   agent configure <endpoint> <apiKey>
 *   agent <prompt...>
 */
export function createAgentCommand(defaultOptions: Partial<AgentOptions> = {}) {
  return defineCommand('agent', async (args, ctx) => {
    if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
      return {
        stdout: [
          'Usage:',
          '  agent configure                    Interactively set API endpoint & key',
          '  agent configure <endpoint> <key>   Set API endpoint & key directly',
          '  agent configure --show             Show current configuration',
          '  agent configure --clear            Clear stored configuration',
          '  agent <prompt>                     Execute a task using the AI agent',
          '',
          'Examples:',
          '  agent configure',
          '  agent write a poem poem.md about cheese pizza',
          '  agent analyze data.csv and output summary.txt',
          '',
        ].join('\n'),
        stderr: '',
        exitCode: 0,
      };
    }

    const firstArg = args[0].toLowerCase();

    // 1. Handle `agent configure` / `agent config`
    if (firstArg === 'configure' || firstArg === 'config') {
      const configArgs = args.slice(1);

      if (configArgs.includes('--show') || configArgs.includes('-s') || configArgs[0] === 'show') {
        const stored = getStoredAgentConfig();
        return {
          stdout: [
            'Current Agent Configuration:',
            `  Endpoint: ${stored.endpoint || '(default)'}`,
            `  API Key:  ${maskApiKey(stored.apiKey)}`,
            '',
          ].join('\n'),
          stderr: '',
          exitCode: 0,
        };
      }

      if (configArgs.includes('--clear') || configArgs[0] === 'clear') {
        clearStoredAgentConfig();
        return {
          stdout: 'Agent configuration cleared from local storage.\n',
          stderr: '',
          exitCode: 0,
        };
      }

      let endpoint: string | undefined;
      let apiKey: string | undefined;

      // Check for --endpoint and --key / --api-key flags
      for (let i = 0; i < configArgs.length; i++) {
        if ((configArgs[i] === '--endpoint' || configArgs[i] === '-e') && configArgs[i + 1]) {
          endpoint = configArgs[i + 1];
          i++;
        } else if (
          (configArgs[i] === '--key' || configArgs[i] === '--api-key' || configArgs[i] === '-k') &&
          configArgs[i + 1]
        ) {
          apiKey = configArgs[i + 1];
          i++;
        }
      }

      // Check positional arguments: agent configure <endpoint> <apiKey>
      const positional = configArgs.filter((a) => !a.startsWith('-'));
      if (!endpoint && positional[0]) {
        endpoint = positional[0];
      }
      if (!apiKey && positional[1]) {
        apiKey = positional[1];
      }

      // If missing arguments and in browser, prompt interactively
      if (!endpoint || !apiKey) {
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          const currentConfig = getStoredAgentConfig();

          if (!endpoint) {
            const userEndpoint = window.prompt(
              'Enter Agent API URL Endpoint (e.g. https://api.openai.com/v1):',
              currentConfig.endpoint || 'https://api.openai.com/v1'
            );
            if (userEndpoint === null) {
              return {
                stdout: 'Configuration cancelled by user.\n',
                stderr: '',
                exitCode: 0,
              };
            }
            endpoint = userEndpoint.trim() || undefined;
          }

          if (!apiKey) {
            const userKey = window.prompt(
              'Enter Agent API Key:',
              currentConfig.apiKey || ''
            );
            if (userKey === null) {
              return {
                stdout: 'Configuration cancelled by user.\n',
                stderr: '',
                exitCode: 0,
              };
            }
            apiKey = userKey.trim() || undefined;
          }
        }
      }

      if (!endpoint && !apiKey) {
        return {
          stdout: '',
          stderr:
            'agent configure error: Please provide endpoint and API key or run in interactive browser environment.\n' +
            'Usage: agent configure <endpoint> <apiKey> or agent configure --endpoint <url> --key <key>\n',
          exitCode: 1,
        };
      }

      setStoredAgentConfig({ endpoint, apiKey });
      const savedConfig = getStoredAgentConfig();

      return {
        stdout: [
          'Agent configuration saved successfully to local storage!',
          `  Endpoint: ${savedConfig.endpoint || '(default)'}`,
          `  API Key:  ${maskApiKey(savedConfig.apiKey)}`,
          '',
        ].join('\n'),
        stderr: '',
        exitCode: 0,
      };
    }

    // 2. Handle `agent <prompt...>`
    const prompt = args.join(' ').trim();
    if (!prompt) {
      return {
        stdout: '',
        stderr: 'agent error: Prompt cannot be empty. Run "agent --help" for usage.\n',
        exitCode: 1,
      };
    }

    const storedConfig = getStoredAgentConfig();
    const resolvedEndpoint =
      storedConfig.endpoint ||
      defaultOptions.endpoint ||
      (typeof process !== 'undefined' ? process.env?.AGENT_ENDPOINT || process.env?.OPENAI_BASE_URL : undefined);
    const resolvedApiKey =
      storedConfig.apiKey ||
      defaultOptions.apiKey ||
      (typeof process !== 'undefined' ? process.env?.AGENT_API_KEY || process.env?.OPENAI_API_KEY : undefined);

    if (!resolvedApiKey) {
      return {
        stdout: '',
        stderr:
          'Error: Agent API key is not configured.\n' +
          'Please run "agent configure" to set up your API endpoint and API key.\n',
        exitCode: 1,
      };
    }

    const outputs: string[] = [];

    try {
      const sandbox =
        defaultOptions.sandbox ||
        (typeof window !== 'undefined' ? (window as any).bashSandbox : undefined);

      const emitChunk = (chunk: string) => {
        outputs.push(chunk);
        if (sandbox && typeof (sandbox as any).emitStdout === 'function') {
          (sandbox as any).emitStdout(chunk.endsWith('\n') ? chunk : chunk + '\n');
        }
      };

      const result = await agent(prompt, {
        ...defaultOptions,
        endpoint: resolvedEndpoint,
        apiKey: resolvedApiKey,
        sandbox,
        verbose: false,
        onStep: (step) => {
          if (step.response && step.toolCalls && step.toolCalls.length > 0) {
            const trimmed = step.response.trim();
            if (trimmed) {
              emitChunk(`[Reasoning]\n${trimmed}`);
            }
          }
        },
        onToolCall: (toolCall) => {
          const { name, args, result: toolResult } = toolCall;
          if (name === 'bash' && args?.command) {
            let chunk = `$ ${args.command}`;
            if (toolResult && toolResult !== '(command completed with no output)') {
              chunk += `\n${toolResult}`;
            }
            emitChunk(chunk);
          } else {
            const argStr = typeof args === 'object' ? JSON.stringify(args) : String(args);
            let chunk = `$ [${name}] ${argStr}`;
            if (toolResult) {
              chunk += `\n${toolResult}`;
            }
            emitChunk(chunk);
          }
        },
      });

      if (!result.success) {
        return {
          stdout: outputs.join('\n') + '\n',
          stderr: `Agent Error: ${result.error || result.output || 'Task execution failed'}\n`,
          exitCode: 1,
        };
      }

      if (result.output && result.output.trim()) {
        const finalMsg = `Agent:\n${result.output.trim()}`;
        emitChunk(finalMsg);
      }

      let finalStdout = outputs.join('\n');
      if (!finalStdout.endsWith('\n')) finalStdout += '\n';

      return {
        stdout: finalStdout,
        stderr: '',
        exitCode: 0,
      };
    } catch (err: any) {
      return {
        stdout: outputs.join('\n') + '\n',
        stderr: `Agent Exception: ${err?.message || String(err)}\n`,
        exitCode: 1,
      };
    }
  });
}
