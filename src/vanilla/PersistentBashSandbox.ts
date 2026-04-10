import { 
    Bash, 
    type ExecResult,
    type IFileSystem,
} from 'just-bash/browser';

// Internal types from just-bash 
export interface BashExecResult extends ExecResult {
    env: Record<string, string>;
}

// Internal types from just-bash (manually mapped since they might not be exported in the browser bundle)
// We'll try to use the ones from 'just-bash' if available, or just use 'any' for the complex state for now.

export interface PersistentBashOptions {
    files?: Record<string, string>;
    cwd?: string;
    env?: Record<string, string>;
    customCommands?: any[];
}

/**
 * A stateful version of BashSandbox that preserves CWD, variables, and functions 
 * between executions.
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

        this.bash = new Bash({
            files: options.files,
            cwd: this.currentCwd,
            env: this.currentEnv,
            customCommands: options.customCommands,
        });
    }

    /**
     * Executes a command and preserves the resulting environment and CWD.
     */
    async exec(command: string): Promise<ExecResult> {
        try {
            // We use the standard Bash.exec but pass the current state
            // and capture the new state returned in BashExecResult.
            const result = await (this.bash.exec(command, {
                cwd: this.currentCwd,
                env: this.currentEnv
            }) as Promise<BashExecResult>);

            // Update persistent state
            if (result.env) {
                this.currentEnv = { ...result.env };
                // Capture new CWD from PWD env var which bash updates automatically
                if (result.env.PWD) {
                    this.currentCwd = result.env.PWD;
                }
            }

            return {
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode
            };
        } catch (e: any) {
            return {
                stdout: '',
                stderr: `Error: ${e.message || e}\n`,
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

    getFilesystem(): IFileSystem {
        return this.bash.fs;
    }

    /**
     * Basic tab completion for files in the current directory.
     * In a more advanced version, we'd use 'just-bash' internal completion logic.
     */
    async getCompletions(line: string): Promise<string[]> {
        const parts = line.split(/\s+/);
        const lastPart = parts[parts.length - 1] || '';
        
        // Very basic: just list files in CWD matching the prefix
        try {
            const files = await this.bash.exec(`ls -a`, { cwd: this.currentCwd, env: this.currentEnv });
            const allFiles = files.stdout.split('\n').map(f => f.trim()).filter(f => f && f !== '.' && f !== '..');
            return allFiles.filter(f => f.startsWith(lastPart));
        } catch {
            return [];
        }
    }
}
