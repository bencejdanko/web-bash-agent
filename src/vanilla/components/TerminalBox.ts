import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { BaseComponent } from '../BaseComponent';
import { ExternalLinkIcon } from './Icons';
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

    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        div.className = `terminal-box ${this.props.isMinimal ? 'minimal' : ''} light`;
        return div;
    }

    init() {
        if (this.initialized) return;

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

        let inputBuffer = '';
        this.terminal.onData(async data => {
            if (!this.props.bashSandbox || this.props.isPending) return;

            if (data === '\r') { // Enter
                this.terminal?.write('\r\n');
                const cmd = inputBuffer.trim();
                if (cmd) {
                    await this.executeManualCommand(cmd);
                } else {
                    this.terminal?.write(this.getPrompt());
                }
                inputBuffer = '';
            } else if (data === '\x7f' || data === '\b') { // Backspace
                if (inputBuffer.length > 0) {
                    inputBuffer = inputBuffer.slice(0, -1);
                    this.terminal?.write('\b \b');
                }
            } else {
                // Handle normal input (including multi-character pastes)
                // Filter out control sequences if they sneak in
                const filtered = data.split('').filter(char => char.charCodeAt(0) >= 32 || char === '\t').join('');
                if (filtered) {
                    inputBuffer += filtered;
                    this.terminal?.write(filtered);
                }
            }
        });

        const resizeObserver = new ResizeObserver(() => {
            try { this.fitAddon?.fit(); } catch (e) {}
        });
        resizeObserver.observe(container);
    }

    private async executeManualCommand(command: string) {
        if (!this.props.bashSandbox || !this.terminal) return;
        
        try {
            const result = await this.props.bashSandbox.exec(command);
            
            if (result.stdout) {
                this.terminal.write(result.stdout.replace(/\n/g, '\r\n'));
            }
            if (result.stderr) {
                this.terminal.write(`\x1b[31m${result.stderr.replace(/\n/g, '\r\n')}\x1b[0m`);
            }
            if (result.stdout && !result.stdout.endsWith('\n')) {
                this.terminal.write('\r\n');
            }
        } catch (e: any) {
            this.terminal.write(`\x1b[31mError: ${e.message || e}\x1b[0m\r\n`);
        }
        
        this.terminal.write(this.getPrompt());
    }

    private getPrompt() {
        return `\x1b[32m$\x1b[0m `;
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
                                <span>Relocate</span>${ExternalLinkIcon(12)}
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

        if (this.props.output !== this.lastOutput || this.props.isPending) {
            term.reset();
            if (this.props.command && this.props.command !== 'bash') {
                term.writeln(`\x1b[1;32m$\x1b[0m ${this.props.command}`);
            }
            
            if (this.props.isPending) {
                term.write('\r\n\x1b[2mProcessing...\x1b[0m');
            } else if (this.props.output) {
                const outputLines = this.props.output.split('\n');
                outputLines.forEach((line, idx) => {
                    const prefix = idx === outputLines.length - 1 ? '\x1b[2m└\x1b[0m ' : '\x1b[2m│\x1b[0m ';
                    term.writeln(`${prefix} ${line}`);
                });
                term.write(this.getPrompt());
            } else {
                term.write(this.getPrompt());
            }
            this.lastOutput = this.props.output;
        }
    }

    destroy() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
    }
}
