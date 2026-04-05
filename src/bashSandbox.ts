/**
 * BashSandbox: A full virtual bash environment powered by just-bash,
 * with Pagefind integration via a custom `search` command.
 *
 * Replaces the limited 3-command BashEngine with a real bash shell
 * that supports 80+ commands, pipes, redirections, globs, and more.
 */
import { Bash } from 'just-bash';
import { createSearchCommand } from './commands/search';
import { createFetchInternalCommand } from './commands/fetch-internal';



export interface BashSandboxOptions {
  /** Files to pre-load into the virtual filesystem under /site/ */
  files?: Record<string, string>;
  /** Pagefind instance for full-text search */
  pagefind?: any;
  /** Additional custom commands to add to the bash shell */
  customCommands?: any[];
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}


export function normalizeSitePath(path: string): string {
  if (path.startsWith('/site/')) return path;
  if (path === '/site') return '/site/';
  return `/site${path.startsWith('/') ? '' : '/'}${path}`;
}

export class BashSandbox {
  private bash: Bash;
  private files: Record<string, string> = {};

  constructor(options: BashSandboxOptions = {}) {
    // Build the filesystem: mount everything under /site/
    if (options.files) {
      for (const [path, content] of Object.entries(options.files)) {
        this.files[normalizeSitePath(path)] = content;
      }
    }

    // Build core commands
    const coreCommands = [
      createSearchCommand(options.pagefind),
      createFetchInternalCommand(),
    ];

    // Merge with user-provided custom commands
    const allCommands = [...coreCommands, ...(options.customCommands || [])];

    this.bash = new Bash({
      files: this.files,
      cwd: '/site',
      customCommands: allCommands,
    });


  }


  /**
   * Execute a bash command in the virtual environment.
   * Returns stdout, stderr, and exit code.
   */

  async exec(command: string): Promise<ExecResult> {
    try {
      const result = await this.bash.exec(command);
      

      const decode = (val: any) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        
        // Handle Uint8Array, Buffer, or array of numbers
        if (val instanceof Uint8Array || (val && val.constructor && val.constructor.name === 'Uint8Array') || Array.isArray(val)) {
            try {
                return new TextDecoder().decode(Uint8Array.from(val));
            } catch (e) {
                return String(val);
            }
        }
        return String(val);
      };

      return {
        stdout: decode(result.stdout),
        stderr: decode(result.stderr),
        exitCode: result.exitCode ?? 0,
      };
    } catch (e) {
      return {
        stdout: '',
        stderr: `Internal error: ${e}\n`,
        exitCode: 127,
      };
    }
  }

  /**
   * Get the current working directory of the shell.
   */
  getCwd(): string {
    return (this.bash as any).cwd || '/site';
  }

  /**
   * Returns the current state of the virtual filesystem.
   */
  getFilesystem(): Record<string, string> {
    // Note: this returns the INITIAL files plus any additions.
    // In a more advanced version, we'd sync this with just-bash's internal state.
    // For now, this is what the agent mostly cares about for mentions.
    return { ...this.files };
  }
}
