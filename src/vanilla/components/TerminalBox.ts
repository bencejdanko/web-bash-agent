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

        this.terminal.onData(data => {
            // Basic input handling if needed, though mostly used for display
            if (this.props.bashSandbox) {
                // ... handle manual input if required ...
            }
        });

        const resizeObserver = new ResizeObserver(() => {
            try { this.fitAddon?.fit(); } catch (e) {}
        });
        resizeObserver.observe(container);
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
            const getPrompt = () => `\x1b[32m$\x1b[0m `;
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
                term.write(getPrompt());
            } else {
                term.write(getPrompt());
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
