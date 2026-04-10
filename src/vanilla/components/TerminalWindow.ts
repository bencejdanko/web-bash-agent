import { BaseComponent } from '../BaseComponent';
import { TerminalBox } from './TerminalBox';
import { CubeIcon, XIcon, PlusIcon } from './Icons';

interface TerminalWindowProps {
    terminals: { id: string; command?: string; output?: string }[];
    activeTerminalId: string | null;
    onSelectTerminal: (id: string) => void;
    onAddTerminal: () => void;
    onClose: () => void;
    bashSandbox: any;
}

export class TerminalWindow extends BaseComponent<TerminalWindowProps> {
    private isDragging = false;
    private offset = { x: 0, y: 0 };
    private position = { x: (window.innerWidth / 2) - 325, y: (window.innerHeight / 2) - 200 };
    private terminalCache: Map<string, TerminalBox> = new Map();

    protected createRootElement(): HTMLElement {
        if (!this.position) {
            this.position = { x: (window.innerWidth / 2) - 325, y: (window.innerHeight / 2) - 200 };
        }
        const div = document.createElement('div');
        div.className = 'terminal-window-overlay';
        div.style.position = 'fixed';
        div.style.top = `${this.position.y}px`;
        div.style.left = `${this.position.x}px`;
        div.style.zIndex = '10002';
        div.style.pointerEvents = 'auto';
        return div;
    }

    init() {
        this.render();
        this.setupDragging();
    }

    private setupDragging() {
        this.element.addEventListener('mousedown', (e) => {
            const target = e.target as HTMLElement;
            const header = target.closest('.terminal-window-header');
            if (!header || target.closest('button')) return;

            this.isDragging = true;
            this.offset.x = e.clientX - this.position.x;
            this.offset.y = e.clientY - this.position.y;
            (header as HTMLElement).style.cursor = 'grabbing';
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.position.x = e.clientX - this.offset.x;
            this.position.y = e.clientY - this.offset.y;
            this.element.style.left = `${this.position.x}px`;
            this.element.style.top = `${this.position.y}px`;
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                const header = this.query<HTMLElement>('.terminal-window-header');
                if (header) header.style.cursor = 'grab';
            }
        });
    }

    render() {
        this.element.innerHTML = `
            <div class="terminal-window-container">
                <div class="terminal-window-header">
                    <div style="display: flex; align-items: center; gap: 8px">
                        ${CubeIcon(16)}
                        <span style="font-weight: 600; font-size: 13px">Terminal Manager</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px">
                         <button class="add-terminal-btn" title="New Terminal Session">
                            ${PlusIcon(14)}
                        </button>
                        <button class="close-window-btn">
                            ${XIcon(14)}
                        </button>
                    </div>
                </div>
                <div class="terminal-window-body">
                    <div class="terminal-window-left">
                        <div id="active-terminal-root" style="height: 100%"></div>
                    </div>
                    <div class="terminal-window-right">
                        <div class="terminal-list-header">SESSIONS</div>
                        <div class="terminal-list agent-scrollbar">
                            ${this.props.terminals.map(t => `
                                <div class="terminal-list-item ${t.id === this.props.activeTerminalId ? 'active' : ''}" data-id="${t.id}">
                                    ${CubeIcon(12)}
                                    <span class="terminal-name">bash</span>
                                    <span class="terminal-id">[${t.id.slice(0, 8)}]</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Action Buttons
        this.query('.close-window-btn')?.addEventListener('click', () => this.props.onClose());
        this.query('.add-terminal-btn')?.addEventListener('click', () => this.props.onAddTerminal());

        // List Interaction
        this.element.querySelectorAll('.terminal-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                if (id) this.props.onSelectTerminal(id);
            });
        });

        // Initialize/Update TerminalBox
        const activeTerminal = this.props.terminals.find(t => t.id === this.props.activeTerminalId);
        const root = this.query('#active-terminal-root');
        
        if (activeTerminal && root) {
            let termBox = this.terminalCache.get(activeTerminal.id);
            const boxProps = {
                command: activeTerminal.command || 'bash',
                output: activeTerminal.output,
                bashSandbox: this.props.bashSandbox,
                isMinimal: true
            };

            if (!termBox) {
                termBox = new TerminalBox(boxProps);
                termBox.init();
                this.terminalCache.set(activeTerminal.id, termBox);
            } else {
                termBox.update(boxProps);
            }
            
            root.innerHTML = '';
            root.appendChild(termBox.getElement());
        } else if (root) {
            root.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--agent-text-muted); font-size: 12px">No active session. Create one with + button.</div>';
        }
    }
}
