import { 
    Bash, 
    type ExecResult,
    type IFileSystem,
} from 'just-bash/browser';
export type { ExecResult, IFileSystem };
import { createSearchCommand } from '../commands/search';
import { createFetchInternalCommand } from '../commands/fetch-internal';
import { createNavigateCommand } from '../commands/navigate';

// Internal types from just-bash 
export interface BashExecResult extends ExecResult {
    env: Record<string, string>;
}

export interface PersistentBashOptions {
    files?: Record<string, string>;
    fs?: IFileSystem;
    cwd?: string;
    env?: Record<string, string>;
    customCommands?: any[];
    pagefind?: any;
    normalizePaths?: boolean;
}

export function normalizeSitePath(path: string): string {
    if (path.startsWith('/site/')) return path;
    if (path === '/site') return '/site/';
    return `/site${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * A unified, stateful version of BashSandbox that preserves CWD, variables, 
 * and functions between executions.
 */
export class PersistentBashSandbox {
    private bash: Bash;
    private currentCwd: string;
    private currentEnv: Record<string, string>;

    constructor(options: PersistentBashOptions = {}) {
        this.currentCwd = options.cwd || '/site';
        this.currentEnv = { 
            PATH: '/bin:/usr/bin',
            HOME: '/home/user',
            USER: 'user',
            SHELL: '/bin/bash',
            TERM: 'xterm-256color',
            ...options.env 
        };

        // Prepare files (with optional normalization)
        let initialFiles = options.files || {};
        if (options.normalizePaths) {
            const normalized: Record<string, string> = {};
            for (const [path, content] of Object.entries(initialFiles)) {
                normalized[normalizeSitePath(path)] = content;
            }
            initialFiles = normalized;
        }

        // Build core commands (Pagefind + Internal Fetch)
        const coreCommands = [
            createSearchCommand(options.pagefind),
            createFetchInternalCommand(),
            createNavigateCommand(),
        ];
        const allCommands = [...coreCommands, ...(options.customCommands || [])];

        this.bash = new Bash({
            files: initialFiles,
            fs: options.fs,
            cwd: this.currentCwd,
            env: this.currentEnv,
            customCommands: allCommands,
        });
    }

    private decode(val: any): string {
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
    }

    /**
     * Executes a command and preserves the resulting environment and CWD.
     */
    async exec(command: string): Promise<ExecResult> {
        try {
            const result = await (this.bash.exec(command, {
                cwd: this.currentCwd,
                env: this.currentEnv
            }) as Promise<BashExecResult>);

            // Update persistent state
            if (result.env) {
                this.currentEnv = { ...this.currentEnv, ...result.env };
                // Capture new CWD from PWD env var
                if (result.env.PWD) {
                    this.currentCwd = result.env.PWD;
                }
            }

            const stdout = this.decode(result.stdout);
            const stderr = this.decode(result.stderr);

            return {
                stdout: stdout,
                stderr: stderr,
                exitCode: result.exitCode ?? 0
            };
        } catch (e: any) {
            console.error('Bash Sandbox Runtime Error:', e);
            return {
                stdout: '',
                stderr: `Runtime Error: ${e.message || e}\n`,
                exitCode: 127
            };
        }
    }

    getCwd(): string {
        return this.currentCwd;
    }

    getEnv(): Record<string, string> {
        return { ...this.currentEnv };
    }

    getFilesystem(): Record<string, string> {
        // Compatibility snapshot for agent mentions
        const fs = this.bash.fs as any;
        if (typeof fs.getAllPaths === 'function') {
            const paths = fs.getAllPaths();
            const result: Record<string, string> = {};
            paths.forEach((p: string) => { result[p] = '[file]'; });
            return result;
        }
        return {};
    }

    get fs(): IFileSystem {
        return this.bash.fs;
    }

    /**
     * Basic tab completion for files in the current directory.
     */
    async getCompletions(line: string): Promise<string[]> {
        const parts = line.split(/\s+/);
        const lastPart = parts[parts.length - 1] || '';
        
        try {
            const entries = await this.bash.fs.readdir(this.currentCwd);
            return entries.filter(e => e.startsWith(lastPart));
        } catch {
            return [];
        }
    }
}
