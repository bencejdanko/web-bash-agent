import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { BaseComponent } from '../BaseComponent';
import { RelocateIcon } from './Icons';
import { PersistentBashSandbox } from '../PersistentBashSandbox';
import '@xterm/xterm/css/xterm.css';

interface TerminalBoxProps {
  command: string;
  output?: string;
  bashSandbox?: any;
  isPending?: boolean;
  startTime?: number;
  onOpenExternal?: () => void;
  isMinimal?: boolean;
}

export class TerminalBox extends BaseComponent<TerminalBoxProps> {
    private terminal: Terminal | null = null;
    private fitAddon: FitAddon | null = null;
    private initialized = false;
    private lastOutput: string | undefined = undefined;
    private persistentSandbox: PersistentBashSandbox | null = null;

    // REPL State
    private inputBuffer = '';
    private cursorPosition = 0;
    private history: string[] = [];
    private historyIndex = -1;
    private isExecuting = false;

    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        div.className = `terminal-box ${this.props.isMinimal ? 'minimal' : ''} light`;
        return div;
    }

    init() {
        if (this.initialized) return;

        // For interactive sessions, we need a persistent sandbox
        if (!this.props.isMinimal && !this.persistentSandbox) {
            const sandbox = this.props.bashSandbox;
            const fs = sandbox?.fs; 
            const files = sandbox?.getFilesystem?.();
            
            this.persistentSandbox = new PersistentBashSandbox({
                env: { TERM: 'xterm-256color' },
                fs: (fs && typeof fs.exists === 'function') ? fs : undefined,
                files: (files && typeof files === 'object' && !files.exists) ? files : {}
            });
        }

        this.render(); // Initial HTML structure

        const container = this.query<HTMLElement>('.xterm-container');
        if (!container) return;

        this.terminal = new Terminal({
            cursorBlink: true,
            fontSize: 12,
            lineHeight: 1.2,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            theme: {
                background: '#ffffff',
                foreground: '#18181b',
                cursor: '#18181b',
                selectionBackground: 'rgba(24, 24, 27, 0.1)',
                black: '#18181b',
                red: '#ef4444',
                green: '#16a34a',
                yellow: '#ca8a04',
                blue: '#2563eb',
                magenta: '#9333ea',
                cyan: '#0891b2',
                white: '#ffffff',
            },
            convertEol: true,
            rows: 10,
        });

        this.fitAddon = new FitAddon();
        this.terminal.loadAddon(this.fitAddon);
        this.terminal.open(container);
        
        setTimeout(() => {
            try { this.fitAddon?.fit(); } catch (e) {}
        }, 10);

        this.initialized = true;
        this.updateContent();

        // New Robust REPL Handler
        this.terminal.onData(async data => {
            if (this.isExecuting || this.props.isMinimal) return;
            await this.handleKey(data);
        });

        const resizeObserver = new ResizeObserver(() => {
            try { this.fitAddon?.fit(); } catch (e) {}
        });
        resizeObserver.observe(container);
    }

    private async handleKey(data: string) {
        if (!this.terminal || this.isExecuting || this.props.isMinimal) return;

        if (data === '\r') { // Enter
            this.terminal.write('\r\n');
            const cmd = this.inputBuffer.trim();
            if (cmd) {
                this.history.push(this.inputBuffer);
                this.historyIndex = -1;
                await this.executeManualCommand(cmd);
            } else {
                this.writePrompt();
            }
            this.inputBuffer = '';
            this.cursorPosition = 0;
        } else if (data === '\x7f' || data === '\b') { // Backspace
            if (this.cursorPosition > 0) {
                const before = this.inputBuffer.slice(0, this.cursorPosition - 1);
                const after = this.inputBuffer.slice(this.cursorPosition);
                this.inputBuffer = before + after;
                this.cursorPosition--;
                this.terminal.write('\b');
                this.terminal.write(after + ' '); 
                for (let i = 0; i < after.length + 1; i++) this.terminal.write('\b');
            }
        } else if (data === '\x1b[A') { // Arrow Up
            if (this.history.length > 0) {
                if (this.historyIndex === -1) this.historyIndex = this.history.length - 1;
                else if (this.historyIndex > 0) this.historyIndex--;
                this.replaceInput(this.history[this.historyIndex]);
            }
        } else if (data === '\x1b[B') { // Arrow Down
            if (this.historyIndex !== -1) {
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.replaceInput(this.history[this.historyIndex]);
                } else {
                    this.historyIndex = -1;
                    this.replaceInput('');
                }
            }
        } else if (data === '\x1b[C') { // Arrow Right
            if (this.cursorPosition < this.inputBuffer.length) {
                this.cursorPosition++;
                this.terminal.write(data);
            }
        } else if (data === '\x1b[D') { // Arrow Left
            if (this.cursorPosition > 0) {
                this.cursorPosition--;
                this.terminal.write(data);
            }
        } else if (data === '\t') { // Tab Completion
            if (this.persistentSandbox) {
                const completions = await this.persistentSandbox.getCompletions(this.inputBuffer);
                if (completions.length === 1) {
                    const parts = this.inputBuffer.split(/\s+/);
                    const lastPart = parts.pop() || '';
                    const remaining = completions[0].slice(lastPart.length);
                    this.terminal.write(remaining);
                    this.inputBuffer += remaining;
                    this.cursorPosition += remaining.length;
                } else if (completions.length > 1) {
                    this.terminal.write('\r\n' + completions.join('  ') + '\r\n');
                    this.terminal.write(this.getPrompt() + this.inputBuffer);
                }
            }
        } else if (data === '\x03') { // Ctrl+C
            this.terminal.write('^C\r\n');
            this.inputBuffer = '';
            this.cursorPosition = 0;
            this.historyIndex = -1;
            this.writePrompt();
        } else { // Handle printable chars (including multi-char pastes)
            for (const char of data) {
                if (char.charCodeAt(0) >= 32) {
                    const before = this.inputBuffer.slice(0, this.cursorPosition);
                    const after = this.inputBuffer.slice(this.cursorPosition);
                    this.inputBuffer = before + char + after;
                    this.cursorPosition += char.length;
                    this.terminal.write(char + after);
                    for (let n = 0; n < after.length; n++) this.terminal.write('\b');
                }
            }
        }
    }

    private replaceInput(newInput: string) {
        if (!this.terminal) return;
        for (let i = 0; i < this.cursorPosition; i++) this.terminal.write('\b');
        for (let i = 0; i < this.inputBuffer.length; i++) this.terminal.write(' ');
        for (let i = 0; i < this.inputBuffer.length; i++) this.terminal.write('\b');
        this.inputBuffer = newInput;
        this.cursorPosition = newInput.length;
        this.terminal.write(newInput);
    }

    private async executeManualCommand(command: string) {
        if (!this.terminal) return;
        const sandbox = this.persistentSandbox || this.props.bashSandbox;
        if (!sandbox) return;

        const cmd = command.trim();
        if (cmd === 'clear') {
            this.terminal.clear();
            this.writePrompt();
            return;
        }

        this.isExecuting = true;
        try {
            const result = await sandbox.exec(command);
            if (result.stdout) this.writeOutput(result.stdout);
            if (result.stderr) this.writeOutput(result.stderr, true);
            if (result.stdout && !result.stdout.endsWith('\n')) this.terminal.write('\r\n');
        } catch (e: any) {
            this.writeOutput(`Error: ${e.message || e}`, true);
        }
        this.isExecuting = false;
        this.writePrompt();
    }

    private getPrompt() {
        const sandbox = this.persistentSandbox || this.props.bashSandbox;
        const cwd = sandbox?.getCwd?.() || '/site';
        const displayCwd = cwd === '/site' ? '~' : cwd.replace('/site', '~').replace(/\/$/, '');
        return `\x1b[32muser@agent\x1b[0m:\x1b[34m${displayCwd}\x1b[0m$ `;
    }

    private writePrompt() {
        this.terminal?.write(this.getPrompt());
    }

    private writeOutput(text: string, isError = false) {
        const formatted = text.replace(/\n/g, '\r\n');
        this.terminal?.write(isError ? `\x1b[31m${formatted}\x1b[0m` : formatted);
    }

    private writeCommandLine(command: string) {
        this.terminal?.writeln(`${this.getPrompt().trim()} ${command}`);
    }

    render() {
        if (!this.initialized) {
            this.element.innerHTML = `
                ${!this.props.isMinimal ? `
                    <div class="terminal-header">
                        <div style="display: flex; align-items: center; gap: 8px">
                            <span>${this.props.isPending ? 'Running command...' : 'Ran command'}</span>
                            ${this.props.isPending && this.props.startTime ? `<span class="streaming-indicator" style="background: #71717a"></span>` : ''}
                        </div>
                        ${this.props.onOpenExternal ? `
                            <button class="terminal-external-btn" title="Open in standalone terminal">
                                <span>Relocate</span>${RelocateIcon(12)}
                            </button>
                        ` : ''}
                    </div>
                ` : ''}
                <div class="xterm-container" style="padding: ${this.props.isMinimal ? '0' : '12px'}; background-color: #ffffff; overflow: hidden; height: 100%;"></div>
            `;

            if (this.props.onOpenExternal) {
                this.query('.terminal-external-btn')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.props.onOpenExternal?.();
                });
            }
        } else {
            this.updateContent();
        }
    }

    private updateContent() {
        const term = this.terminal;
        if (!term) return;

        // Determine if we need to full-reset or just show initial state
        const isInteractive = !this.props.isMinimal && this.persistentSandbox;
        
        if (!isInteractive) {
            if (this.props.output !== this.lastOutput || this.props.isPending) {
                this.refreshStaticContent();
                this.lastOutput = this.props.output;
            }
        } else if (this.lastOutput === undefined) {
             this.refreshStaticContent();
             this.lastOutput = this.props.output || '';
        }
    }

    private refreshStaticContent() {
        const term = this.terminal;
        if (!term) return;

        term.reset();
        
        // 1. Initial Command
        if (this.props.command && this.props.command !== 'bash') {
            this.writeCommandLine(this.props.command);
        }

        // 2. Output or Pending State
        if (this.props.isPending) {
            term.write('\r\n\x1b[2mProcessing...\x1b[0m');
        } else if (this.props.output) {
            if (this.props.isMinimal) {
                // Historical view with decorative prefixes
                const lines = this.props.output.split('\n');
                lines.forEach((line, idx) => {
                    const prefix = idx === lines.length - 1 ? '\x1b[2m└\x1b[0m ' : '\x1b[2m│\x1b[0m ';
                    term.writeln(`${prefix} ${line}`);
                });
            } else {
                // Interactive starting view
                this.writeOutput(this.props.output);
                if (!this.props.output.endsWith('\n')) term.write('\r\n');
            }
            this.writePrompt();
        } else {
            this.writePrompt();
        }
    }

    destroy() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
    }
}
