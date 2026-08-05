import { 
    Bash, 
    type ExecResult,
    type IFileSystem,
} from 'just-bash/browser';
export type { ExecResult, IFileSystem };

// Internal types from just-bash 
export interface BashExecResult extends ExecResult {
    env: Record<string, string>;
}

export interface PersistentBashOptions {
    files?: Record<string, string>;
    fs?: IFileSystem;
    cwd?: string;
    env?: Record<string, string>;
    customCommands?: (context: { getFs: () => any }) => any[];
    normalizePaths?: boolean;
}

/**
 * A unified, stateful version of BashSandbox that preserves CWD, variables, 
 * and functions between executions.
 */
export class PersistentBashSandbox {
    private bash: Bash;
    private currentCwd: string;
    private currentEnv: Record<string, string>;
    private subshellHandler: ((command: string) => Promise<ExecResult>) | null = null;
    private customPromptFn: (() => string) | null = null;

    constructor(options: PersistentBashOptions = {}) {
        this.currentCwd = options.cwd || '/';
        this.currentEnv = { 
            PATH: '/bin:/usr/bin',
            HOME: '/home/user',
            USER: 'user',
            SHELL: '/bin/bash',
            TERM: 'xterm-256color',
            ...options.env 
        };

        // Prepare files (no normalization/prefixing)
        const initialFiles = options.files || {};

        // 1. Prepare Context for late-binding (e.g. FS)
        const context = { 
            getFs: () => this.bash?.fs,
            getSandbox: () => this,
            setSubshell: (handler: any, promptFn?: any) => this.setSubshell(handler, promptFn),
        };
        
        // 2. Resolve commands from the mandatory factory (if provided)
        const allCommands = options.customCommands ? options.customCommands(context) : [];

        this.bash = new Bash({
            files: initialFiles,
            fs: options.fs,
            cwd: this.currentCwd,
            env: this.currentEnv,
            customCommands: allCommands,
        });

        if (typeof window !== 'undefined') {
            (window as any).bashSandbox = this;
            (window as any).bash = async (command: string) => {
                const res = await this.exec(command);
                if (res.stdout) console.log(res.stdout);
                if (res.stderr) console.error(res.stderr);
                return res;
            };
            (window as any).exec = (window as any).bash;
            const fsFn: any = (dirPath = '/') => this.bash.fs.readdir(dirPath);
            fsFn.ls = (dirPath = '/') => this.bash.fs.readdir(dirPath);
            fsFn.cat = async (filePath: string) => {
                const content = await this.bash.fs.readFile(filePath);
                return this.decode(content);
            };
            fsFn.write = (filePath: string, text: string) => this.bash.fs.writeFile(filePath, text);
            fsFn.rm = (filePath: string) => (this.bash.fs as any).unlink ? (this.bash.fs as any).unlink(filePath) : null;
            fsFn.tree = () => (typeof (this.bash.fs as any).getAllPaths === 'function' ? (this.bash.fs as any).getAllPaths() : null);
            fsFn._raw = this.bash.fs;
            (window as any).fs = fsFn;
        }
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

    setSubshell(handler: ((command: string) => Promise<ExecResult>) | null, promptFn?: (() => string) | null) {
        this.subshellHandler = handler;
        this.customPromptFn = promptFn || null;
    }

    getPrompt(): string {
        if (this.customPromptFn) {
            return this.customPromptFn();
        }
        const cwd = this.currentCwd || '/site';
        const displayCwd = cwd === '/site' ? '~' : cwd.replace('/site', '~').replace(/\/$/, '');
        return `\x1b[32muser@agent\x1b[0m:\x1b[34m${displayCwd}\x1b[0m$ `;
    }

    /**
     * Executes a command and preserves the resulting environment and CWD.
     */
    async exec(command: string): Promise<ExecResult> {
        if (this.subshellHandler) {
            return await this.subshellHandler(command);
        }

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
