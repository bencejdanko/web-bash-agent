import { agent, type AgentOptions } from './agent';
import { Sandbox } from './Sandbox';
import { createPythonCommand } from './commands/python';
import { createDuckDBCommand } from './commands/duckdb';
import { createOpenCommand, createSaveCommand, createOpenDirCommand } from './commands/fileaccess';
import { createAgentCommand } from './commands/agent';
import { createEditCommand } from './commands/edit';

/** Built-in commands available by string name. */
const BUILTIN_COMMANDS: Record<string, () => any> = {
  agent: createAgentCommand,
  python: createPythonCommand,
  duckdb: createDuckDBCommand,
  open: createOpenCommand,
  save: createSaveCommand,
  'open-dir': createOpenDirCommand,
  edit: createEditCommand,
};

export interface InitPugilisterOptions extends Omit<AgentOptions, 'sandbox' | 'commands'> {
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /**
   * Commands to register. Pass built-in names ('python', 'duckdb', 'open', 'save', 'open-dir')
   * or pre-instantiated command objects. Defaults to all built-ins.
   *
   * @example
   * commands: ['python', 'duckdb', 'open-dir']
   */
  commands?: Array<string | any>;
}

/**
 * Core initializer for Pugilister.
 * Resolves commands and builds the sandbox. Terminal UI is the consuming app's concern.
 *
 * @example
 * const { sandbox, agent } = initPugilister({ commands: ['python', 'duckdb'] });
 */
export function initPugilister(options: InitPugilisterOptions = {}) {
  // 1. Resolve commands
  const requestedCommands = options.commands ?? Object.keys(BUILTIN_COMMANDS);
  const resolvedCommands: any[] = requestedCommands.map((cmd) => {
    if (typeof cmd === 'string') {
      const factory = BUILTIN_COMMANDS[cmd];
      if (!factory) throw new Error(`[pugilister] Unknown built-in command: "${cmd}". Available: ${Object.keys(BUILTIN_COMMANDS).join(', ')}`);
      return factory();
    }
    return cmd; // already an instantiated command object
  });

  // 2. Build sandbox
  const sandbox = new Sandbox({
    cwd: options.cwd,
    env: options.env,
    customCommands: resolvedCommands,
  });

  // 3. Build runAgent helper
  const runAgent = (prompt: string, opts: Partial<AgentOptions> = {}) => {
    return agent(prompt, {
      sandbox,
      ...options,
      ...opts,
    });
  };

  if (typeof window !== 'undefined') {
    (window as any).runAgent = runAgent;
    (window as any).agent = runAgent;
  }

  return { sandbox, agent: runAgent };
}
