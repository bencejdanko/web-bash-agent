import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { BaseComponent } from '../BaseComponent';
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

        // All terminals (interactive and snapshot) now use the shared session manager
        const manager = (window as any).terminalSessionManager;
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

        this.initialized = true;
        this.updateContent();

        const resizeObserver = new ResizeObserver(() => {
            if (this.element.offsetParent !== null) { // Only fit if visible
                try { this.fitAddon?.fit(); } catch (e) {}
            }
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
                    </div>
                ` : ''}
                <div class="terminal-xterm-wrapper ${this.props.isMinimal ? 'minimal' : 'full'}"></div>
            `;
        } else {
            this.updateContent();
        }
    }

    private updateContent() {
        // No manual rehydration needed here anymore.
        // TerminalSessionManager handles the buffer.
        
        // We only need to ensure the layout is correct if props changed.
        if (this.initialized && this.element.offsetParent !== null) {
            requestAnimationFrame(() => this.fit());
        }

        this.lastOutput = this.props.output;
        this.lastPending = this.props.isPending;
    }

    private refreshStaticContent() {
        // Obsolete in Consolidated Pattern
    }

    destroy() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
    }
}

