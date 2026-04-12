import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { BaseComponent } from '../BaseComponent';
import { RelocateIcon } from './Icons';
import { PersistentBashSandbox } from '../PersistentBashSandbox';
import { TerminalLogic } from '../TerminalLogic';
import '@xterm/xterm/css/xterm.css';
import './TerminalBox.css';

interface TerminalBoxProps {
  id: string; // Key for TerminalSessionManager
  command: string;
  output?: string;
  initialState?: string; // ANSI serialized state
  bashSandbox?: any;
  isPending?: boolean;
  startTime?: number;
  onOpenExternal?: () => void;
  onExit?: () => void;
  isMinimal?: boolean;
  hideHeader?: boolean;
  history?: string[];
  onChange?: () => void;
}

export class TerminalBox extends BaseComponent<TerminalBoxProps> {
    private terminal: Terminal | null = null;
    private fitAddon: FitAddon | null = null;
    private initialized = false;
    private lastOutput: string | undefined = undefined;
    private lastPending: boolean | undefined = undefined;
    private logic: any = null;

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

        if (this.props.isMinimal) {
            // Static/Minimal terminals still create their own instance for isolation
            this.terminal = new Terminal({
                cursorBlink: false,
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
        } else {
            // Interactive terminals use the shared session manager
            const manager = (window as any).terminalSessionManager; // Injected globally or via props
            if (manager) {
                const session = manager.getOrCreateSession(this.props.id, {
                    command: this.props.command,
                    initialOutput: this.props.output,
                    initialHistory: this.props.history,
                    initialState: this.props.initialState,
                    onExit: this.props.onExit
                });
                this.terminal = session.terminal;
                this.fitAddon = session.fitAddon;
                this.logic = session.logic;
                manager.mount(this.props.id, container);
            }
        }

        this.initialized = true;
        this.updateContent();

        const resizeObserver = new ResizeObserver(() => {
            try { this.fitAddon?.fit(); } catch (e) {}
        });
        resizeObserver.observe(container);
    }

    public fit() {
        try { this.fitAddon?.fit(); } catch (e) {}
    }

    public focus() {
        if (this.terminal) {
            this.terminal.focus();
            // Force focus on the underlying textarea to ensure keyboard events are captured
            const textarea = this.element.querySelector('textarea');
            if (textarea) textarea.focus();
        }
    }

    public pressEnter() {
        this.logic?.pressEnter();
    }

    public getContent(): string {
        return this.logic?.getContent() || '';
    }

    public getHistory(): string[] {
        return this.logic?.getHistory() || [];
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
        const outputChanged = this.props.output !== this.lastOutput;
        const pendingChanged = this.props.isPending !== this.lastPending;

        if (this.props.isMinimal) {
            if (outputChanged || pendingChanged) {
                this.refreshStaticContent();
            }
        }

        this.lastOutput = this.props.output;
        this.lastPending = this.props.isPending;
    }


    private refreshStaticContent() {
        const term = this.terminal;
        if (!term) return;

        // Visual reset for static view
        term.reset();
        
        if (this.props.command && this.props.command !== 'bash') {
            term.writeln(`\x1b[2m$ ${this.props.command}\x1b[0m`);
        }
        if (this.props.output) {
            const lines = this.props.output.split('\n');
            lines.forEach((line, idx) => {
                const prefix = idx === lines.length - 1 ? '\x1b[2m└\x1b[0m ' : '\x1b[2m│\x1b[0m ';
                term.writeln(`${prefix} ${line}`);
            });
        }
        if (this.props.isPending) {
            term.write('\x1b[2m│ Processing...\x1b[0m');
        }
    }

    destroy() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
    }
}
