import {
    Bash,
    type ExecResult,
    type IFileSystem,
} from 'just-bash/browser';
export type { ExecResult, IFileSystem };

export interface BashExecResult extends ExecResult {
    env: Record<string, string>;
}

export interface SandboxOptions {
    fs?: IFileSystem;
    cwd?: string;
    env?: Record<string, string>;
    customCommands?: any[];
    normalizePaths?: boolean;
}

export interface CompletionResult {
    completedLine: string;
    matches: string[];
    commonPrefix: string;
    activeToken: string;
    isSingleMatch: boolean;
}

const BUILTIN_COMMAND_NAMES = [
    'agent', 'alias', 'cat', 'cd', 'chmod', 'clear', 'cp', 'duckdb', 'echo', 'edit', 'env',
    'export', 'find', 'grep', 'head', 'history', 'hostname', 'ls', 'mkdir',
    'mv', 'open', 'open-dir', 'python', 'pwd', 'rm', 'rmdir', 'save', 'sort',
    'tail', 'touch', 'type', 'uniq', 'unset', 'wc', 'whoami'
];

function findLongestCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
        while (!strings[i].startsWith(prefix)) {
            prefix = prefix.slice(0, -1);
            if (prefix === '') return '';
        }
    }
    return prefix;
}

/**
 * A unified, stateful bash sandbox that preserves CWD and environment variables between executions.
 */
export class Sandbox {
    private bash: Bash;
    private currentCwd: string;
    private currentEnv: Record<string, string>;
    private customCommandNames: string[];
    private stdoutListeners: Set<(text: string) => void> = new Set();

    public onStdout(listener: (text: string) => void): () => void {
        this.stdoutListeners.add(listener);
        return () => {
            this.stdoutListeners.delete(listener);
        };
    }

    public emitStdout(text: string): void {
        for (const listener of this.stdoutListeners) {
            try {
                listener(text);
            } catch (err) {
                console.error('Error in stdout listener:', err);
            }
        }
    }

    constructor(options: SandboxOptions = {}) {
        this.currentCwd = options.cwd || '/';
        this.currentEnv = {
            PATH: '/bin:/usr/bin',
            HOME: '/home/user',
            USER: 'user',
            SHELL: '/bin/bash',
            TERM: 'xterm-256color',
            ...options.env
        };

        const allCommands = options.customCommands || [];
        this.customCommandNames = allCommands
            .map(cmd => (typeof cmd === 'object' && cmd && cmd.name ? cmd.name : String(cmd)))
            .filter(Boolean);

        this.bash = new Bash({
            fs: options.fs,
            cwd: this.currentCwd,
            env: this.currentEnv,
            customCommands: allCommands,
        });

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
            runBash.exec = (cmd: string) => this.exec(cmd);
            runBash.fs = this.bash.fs;

            (window as any).$ = runBash;
            (window as any).bash = runBash;
            (window as any).pugilister = runBash;
            (window as any).bashSandbox = this;
            (window as any).fs = this.bash.fs;
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
     * Autocomplete searching for commands or file/directory paths.
     */
    async getCompletions(line: string): Promise<CompletionResult> {
        // Split into prefix (everything before the active token) and activeToken
        const lastSpaceIdx = line.lastIndexOf(' ');
        let prefix = '';
        let activeToken = line;
        if (lastSpaceIdx !== -1) {
            prefix = line.slice(0, lastSpaceIdx + 1);
            activeToken = line.slice(lastSpaceIdx + 1);
        }

        const isCommandPosition = prefix.trim() === '' &&
            !activeToken.startsWith('/') &&
            !activeToken.startsWith('./') &&
            !activeToken.startsWith('../') &&
            !activeToken.startsWith('~');

        if (isCommandPosition) {
            const allCommandCandidates = Array.from(new Set([
                ...BUILTIN_COMMAND_NAMES,
                ...this.customCommandNames
            ])).sort();

            const matchingCmds = allCommandCandidates.filter(cmd => cmd.startsWith(activeToken));

            // Also check for executable/file matches in CWD if activeToken is present
            let matchingFiles: string[] = [];
            try {
                const entries = await this.bash.fs.readdir(this.currentCwd);
                matchingFiles = entries.filter(e => e.startsWith(activeToken) && !e.startsWith('.'));
            } catch { }

            const matches = Array.from(new Set([...matchingCmds, ...matchingFiles]));

            if (matches.length === 0) {
                return {
                    completedLine: line,
                    matches: [],
                    commonPrefix: activeToken,
                    activeToken,
                    isSingleMatch: false
                };
            }

            if (matches.length === 1) {
                const isCmd = matchingCmds.includes(matches[0]);
                const completed = prefix + matches[0] + (isCmd ? ' ' : '');
                return {
                    completedLine: completed,
                    matches,
                    commonPrefix: matches[0],
                    activeToken,
                    isSingleMatch: true
                };
            }

            const lcp = findLongestCommonPrefix(matches);
            return {
                completedLine: prefix + lcp,
                matches,
                commonPrefix: lcp,
                activeToken,
                isSingleMatch: false
            };
        }

        // Path / file completion
        const homeDir = this.currentEnv.HOME || '/home/user';
        let expandedToken = activeToken;
        if (expandedToken.startsWith('~')) {
            expandedToken = homeDir + expandedToken.slice(1);
        }

        const lastSlash = expandedToken.lastIndexOf('/');
        let dirPart = '';
        let filePrefix = expandedToken;

        if (lastSlash !== -1) {
            dirPart = expandedToken.slice(0, lastSlash + 1);
            filePrefix = expandedToken.slice(lastSlash + 1);
        }

        let resolveDir = this.currentCwd;
        if (dirPart.startsWith('/')) {
            resolveDir = dirPart;
        } else if (dirPart) {
            resolveDir = this.bash.fs.resolvePath(this.currentCwd, dirPart);
        }

        let entries: string[] = [];
        try {
            entries = await this.bash.fs.readdir(resolveDir);
        } catch {
            entries = [];
        }

        const matchingEntries = entries.filter(e => {
            if (filePrefix === '' && e.startsWith('.')) return false;
            return e.startsWith(filePrefix);
        });

        const formattedCandidates: { candidateToken: string; displayMatch: string; isDir: boolean }[] = [];

        for (const entry of matchingEntries) {
            let isDir = false;
            try {
                const fullEntryPath = this.bash.fs.resolvePath(resolveDir, entry);
                const stat = await this.bash.fs.stat(fullEntryPath);
                isDir = stat.isDirectory;
            } catch { }

            // Preserve original user prefix token (e.g. ~/ or src/ or relative)
            const tokenDirPart = activeToken.includes('/') ? activeToken.slice(0, activeToken.lastIndexOf('/') + 1) : '';
            const candidateToken = tokenDirPart + entry + (isDir ? '/' : '');
            const displayMatch = entry + (isDir ? '/' : '');

            formattedCandidates.push({ candidateToken, displayMatch, isDir });
        }

        const candidateTokens = formattedCandidates.map(c => c.candidateToken);
        const displayMatches = formattedCandidates.map(c => c.displayMatch);

        if (candidateTokens.length === 0) {
            return {
                completedLine: line,
                matches: [],
                commonPrefix: activeToken,
                activeToken,
                isSingleMatch: false
            };
        }

        if (candidateTokens.length === 1) {
            const single = formattedCandidates[0];
            const trailingSpace = single.isDir ? '' : ' ';
            const completed = prefix + single.candidateToken + trailingSpace;
            return {
                completedLine: completed,
                matches: [single.displayMatch],
                commonPrefix: single.candidateToken,
                activeToken,
                isSingleMatch: true
            };
        }

        const lcpToken = findLongestCommonPrefix(candidateTokens);
        return {
            completedLine: prefix + lcpToken,
            matches: displayMatches,
            commonPrefix: lcpToken,
            activeToken,
            isSingleMatch: false
        };
    }
}

