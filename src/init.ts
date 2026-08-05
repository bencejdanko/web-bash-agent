import { agent, type AgentOptions } from './agent';
import { PersistentBashSandbox } from './PersistentBashSandbox';
import { createPythonCommand } from './commands/python';
import { createDuckDBCommand } from './commands/duckdb';
import { createOpenCommand, createSaveCommand, createOpenDirCommand } from './commands/fileaccess';

/** Built-in commands available by string name. */
const BUILTIN_COMMANDS: Record<string, () => any> = {
  python: createPythonCommand,
  duckdb: createDuckDBCommand,
  open: createOpenCommand,
  save: createSaveCommand,
  'open-dir': createOpenDirCommand,
};

export interface InitPugilisterOptions extends Omit<AgentOptions, 'bashSandbox' | 'commands'> {
  /** DOM element ID containing JSON configuration (defaults to 'pugilister-config') */
  configId?: string;
  /** Files to mount into the virtual filesystem, e.g. from import.meta.glob */
  files?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /**
   * Commands to register. Pass built-in names ('python', 'duckdb', 'open', 'save', 'open-dir')
   * or pre-instantiated command objects. Defaults to all built-ins.
   *
   * @example
   * commands: ['python', 'duckdb', createMyCustomCommand()]
   */
  commands?: Array<string | any>;
}

/**
 * 1-liner client initializer for Pugilister.
 *
 * Reads the virtual filesystem from `options.files` or a `<script id="pugilister-config">`
 * DOM element, then starts a sandbox with the requested commands.
 *
 * @example
 * // Vite / Astro / SvelteKit / Nuxt
 * const files = import.meta.glob('/src/content/**\/*.md', { query: '?raw', eager: true });
 * initPugilister({ files, commands: ['python', 'duckdb'] });
 *
 * @example
 * // Vanilla HTML (no bundler)
 * // Add <script id="pugilister-config" type="application/json">{"files":{"hello.txt":"hi"}}</script>
 * initPugilister({ commands: ['python'] });
 */
export function initPugilister(options: InitPugilisterOptions = {}) {
  // 1. Collect files from options or DOM
  let filesystem: Record<string, string> = options.files || {};

  if (typeof document !== 'undefined') {
    const configId = options.configId || 'pugilister-config';
    const configEl = document.getElementById(configId);
    if (configEl?.textContent) {
      try {
        const parsed = JSON.parse(configEl.textContent);
        if (parsed.filesystem) filesystem = { ...parsed.filesystem, ...filesystem };
        if (parsed.files) filesystem = { ...parsed.files, ...filesystem };
      } catch {
        // Ignore parse errors
      }
    }
  }

  // 2. Resolve commands
  const requestedCommands = options.commands ?? Object.keys(BUILTIN_COMMANDS);
  const resolvedCommands: any[] = requestedCommands.map((cmd) => {
    if (typeof cmd === 'string') {
      const factory = BUILTIN_COMMANDS[cmd];
      if (!factory) throw new Error(`[pugilister] Unknown built-in command: "${cmd}". Available: ${Object.keys(BUILTIN_COMMANDS).join(', ')}`);
      return factory();
    }
    return cmd; // already an instantiated command object
  });

  // 3. Build sandbox
  const sandbox = new PersistentBashSandbox({
    files: filesystem,
    cwd: options.cwd,
    env: options.env,
    customCommands: resolvedCommands,
  });

  // 4. Build runAgent helper
  const runAgent = (prompt: string, opts: Partial<AgentOptions> = {}) => {
    return agent(prompt, {
      bashSandbox: sandbox,
      filesystem,
      ...options,
      ...opts,
    });
  };

  if (typeof window !== 'undefined') {
    (window as any).runAgent = runAgent;
    (window as any).agent = runAgent;
  }

  return { sandbox, agent: runAgent, filesystem };
}
