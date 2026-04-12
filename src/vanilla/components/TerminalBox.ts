import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { BaseComponent } from '../BaseComponent';
import { RelocateIcon } from './Icons';
import { PersistentBashSandbox } from '../PersistentBashSandbox';
import { TerminalLogic } from '../TerminalLogic';
import '@xterm/xterm/css/xterm.css';
import './TerminalBox.css';

interface TerminalBoxProps {
  command: string;
  output?: string;
  bashSandbox?: any;
  isPending?: boolean;
  startTime?: number;
  onOpenExternal?: () => void;
  onExit?: () => void;
  isMinimal?: boolean;
  hideHeader?: boolean;
}

export class TerminalBox extends BaseComponent<TerminalBoxProps> {
    private terminal: Terminal | null = null;
    private fitAddon: FitAddon | null = null;
    private initialized = false;
    private lastOutput: string | undefined = undefined;
    private lastPending: boolean | undefined = undefined;
    private logic: TerminalLogic | null = null;

    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        div.className = `terminal-box ${this.props.isMinimal ? 'minimal' : ''} light`;
        return div;
    }

    init() {
        if (this.initialized) return;

        this.render(); // Initial HTML structure

        const container = this.query<HTMLElement>('.terminal-xterm-wrapper');
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
        
        if (this.props.bashSandbox) {
            this.logic = new TerminalLogic({
                terminal: this.terminal,
                sandbox: this.props.bashSandbox,
                onExit: this.props.onExit
            });
        }

        setTimeout(() => {
            try { this.fitAddon?.fit(); } catch (e) {}
        }, 10);

        this.initialized = true;
        this.updateContent();

        // New Robust REPL Handler
        this.terminal.onData(async data => {
            if (this.props.isMinimal || !this.logic) return;
            await this.logic.handleKey(data);
        });

        const resizeObserver = new ResizeObserver(() => {
            try { this.fitAddon?.fit(); } catch (e) {}
        });
        resizeObserver.observe(container);
    }

    public fit() {
        try { this.fitAddon?.fit(); } catch (e) {}
    }

    public focus() {
        this.terminal?.focus();
    }

    public pressEnter() {
        this.logic?.pressEnter();
    }

    public getContent(): string {
        return this.logic?.getContent() || '';
    }

    render() {
        if (!this.initialized) {
            this.element.innerHTML = `
                ${(!this.props.isMinimal && !this.props.hideHeader) ? `
                    <div class="terminal-header">
                        <div class="terminal-header-title">
                            <span>${this.props.isPending ? 'Running command...' : 'Ran command'}</span>
                            ${this.props.isPending && this.props.startTime ? `<span class="terminal-status-dot"></span>` : ''}
                        </div>
                        ${this.props.onOpenExternal ? `
                            <button class="terminal-external-btn" title="Open in standalone terminal">
                                <span>Relocate</span>${RelocateIcon(12)}
                            </button>
                        ` : ''}
                    </div>
                ` : ''}
                <div class="terminal-xterm-wrapper ${this.props.isMinimal ? 'minimal' : 'full'}"></div>
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
        if (this.props.output !== this.lastOutput || this.props.isPending !== this.lastPending) {
            this.refreshStaticContent();
            this.lastOutput = this.props.output;
            this.lastPending = this.props.isPending;
        }
    }

    private refreshStaticContent() {
        const term = this.terminal;
        if (!term) return;

        term.reset();
        
        // 1. Initial Command
        if (this.props.command) {
            this.logic?.writeCommandLine(this.props.command);
        }

        // 2. Output or Pending State
        if (this.props.isPending) {
            term.write('\r\n\x1b[2mProcessing...\x1b[0m');
        } else if (this.props.output !== undefined) {
            if (this.props.isMinimal) {
                // Historical view with decorative prefixes
                const lines = this.props.output.split('\n');
                lines.forEach((line, idx) => {
                    const prefix = idx === lines.length - 1 ? '\x1b[2m└\x1b[0m ' : '\x1b[2m│\x1b[0m ';
                    term.writeln(`${prefix} ${line}`);
                });
            } else {
                // Interactive starting view
                this.logic?.writeOutput(this.props.output);
                if (!this.props.output.endsWith('\n')) term.write('\r\n');
            }
            this.logic?.writePrompt();
            this.logic?.restoreInput();
        } else {
            this.logic?.writePrompt();
            this.logic?.restoreInput();
        }
    }

    destroy() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
    }
}
