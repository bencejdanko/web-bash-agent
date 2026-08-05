import { 
    Bash, 
    type ExecResult,
    type IFileSystem,
} from 'just-bash/browser';
export type { ExecResult, IFileSystem };

export interface BashExecResult extends ExecResult {
    env: Record<string, string>;
}

export interface PersistentBashOptions {
    files?: Record<string, string>;
    fs?: IFileSystem;
    cwd?: string;
    env?: Record<string, string>;
    customCommands?: any[];
    normalizePaths?: boolean;
    /** Automatically fetch missing VFS files via HTTP in browser environments (defaults to true) */
    enableFetchFallback?: boolean;
}

/**
 * A unified, stateful bash sandbox that preserves CWD and environment variables between executions.
 */
export class PersistentBashSandbox {
    private bash: Bash;
    private currentCwd: string;
    private currentEnv: Record<string, string>;

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

        const initialFiles = options.files || {};
        const allCommands = options.customCommands || [];

        this.bash = new Bash({
            files: initialFiles,
            fs: options.fs,
            cwd: this.currentCwd,
            env: this.currentEnv,
            customCommands: allCommands,
        });

        // Set up lazy HTTP fetch fallback for VFS reads in browser
        const shouldEnableFetch = options.enableFetchFallback !== false && typeof window !== 'undefined';
        if (shouldEnableFetch) {
            const originalReadFile = this.bash.fs.readFile.bind(this.bash.fs);
            const originalReadFileBuffer = (this.bash.fs as any).readFileBuffer
                ? (this.bash.fs as any).readFileBuffer.bind(this.bash.fs)
                : null;

            const fetchAndCacheFile = async (filePath: string): Promise<string | Uint8Array | null> => {
                const candidates = new Set<string>();
                candidates.add(filePath);
                if (!filePath.startsWith('/')) {
                    candidates.add('/' + filePath);
                } else {
                    candidates.add(filePath.slice(1));
                }

                for (const candidate of candidates) {
                    try {
                        const res = await window.fetch(candidate);
                        if (res.ok) {
                            const text = await res.text();
                            await this.bash.fs.writeFile(filePath, text);
                            return text;
                        }
                    } catch {
                        // Skip failed candidate fetch
                    }
                }
                return null;
            };

            this.bash.fs.readFile = (async (filePath: string, opts?: any) => {
                try {
                    return await originalReadFile(filePath, opts);
                } catch (err: any) {
                    const isNotFound = err?.message?.includes('ENOENT') || err?.code === 'ENOENT';
                    if (isNotFound) {
                        const fetched = await fetchAndCacheFile(filePath);
                        if (fetched !== null) return fetched;
                    }
                    throw err;
                }
            }) as any;

            if (originalReadFileBuffer) {
                (this.bash.fs as any).readFileBuffer = async (filePath: string) => {
                    try {
                        return await originalReadFileBuffer(filePath);
                    } catch (err: any) {
                        const isNotFound = err?.message?.includes('ENOENT') || err?.code === 'ENOENT';
                        if (isNotFound) {
                            const fetched = await fetchAndCacheFile(filePath);
                            if (fetched !== null) {
                                return typeof fetched === 'string' ? new TextEncoder().encode(fetched) : fetched;
                            }
                        }
                        throw err;
                    }
                };
            }
        }

        if (typeof window !== 'undefined') {
            const runBash = async (cmd?: any, ...args: any[]) => {
                let commandStr = '';
                if (typeof cmd === 'string') {
                    commandStr = cmd;
                } else if (Array.isArray(cmd) && (cmd as any).raw) {
                    commandStr = cmd.reduce((acc, str, i) => acc + str + (args[i] !== undefined ? args[i] : ''), '');
                }

                if (!commandStr?.trim()) return;

                const res = await this.exec(commandStr);
                if (res.stdout) console.log(res.stdout);
                if (res.stderr) console.error(res.stderr);
                return res;
            };

            runBash.sandbox = this;
            runBash.duckdb = (sql: string) => runBash(`duckdb -c ${JSON.stringify(sql)}`);
            runBash.python = (code: string) => runBash(`python -c ${JSON.stringify(code)}`);
            runBash.ls = (path = '') => runBash(`ls ${path}`);
            runBash.cat = (filePath: string) => runBash(`cat ${filePath}`);
            runBash.pwd = () => runBash('pwd');

            (window as any).$ = runBash;
            (window as any).pugilister = runBash;
            (window as any).bash = runBash;
            (window as any).exec = runBash;
            (window as any).duckdb = (sql: string) => runBash(`duckdb -c ${JSON.stringify(sql)}`);
            (window as any).python = (code: string) => runBash(`python -c ${JSON.stringify(code)}`);
            (window as any).ls = (path = '') => runBash(`ls ${path}`);
            (window as any).cat = (filePath: string) => runBash(`cat ${filePath}`);
            (window as any).pwd = () => runBash('pwd');
            (window as any).bashSandbox = this;

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

            if (result.env) {
                this.currentEnv = { ...this.currentEnv, ...result.env };
                if (result.env.PWD) {
                    this.currentCwd = result.env.PWD;
                }
            }

            return {
                stdout: this.decode(result.stdout),
                stderr: this.decode(result.stderr),
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
