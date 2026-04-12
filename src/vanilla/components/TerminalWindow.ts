import { BaseComponent } from '../BaseComponent';
import { CubeIcon, PlusIcon, XIcon } from './Icons';
import { TerminalBox } from './TerminalBox';
import { TerminalSession } from '../ChatLogic';
import './TerminalWindow.css';

interface TerminalWindowProps {
    terminals: TerminalSession[];
    activeTerminalId: string | null;
    onSelectTerminal: (id: string) => void;
    onDeleteTerminal: (id: string) => void;
    onAddTerminal: () => void;
    onClose: () => void;
    onStateChange: () => void;
    bashSandbox: any;
    position?: { x: number, y: number };
    onPositionChange: (pos: { x: number, y: number }) => void;
}

export class TerminalWindow extends BaseComponent<TerminalWindowProps> {
    private position: { x: number, y: number };
    private isDragging = false;
    private offset = { x: 0, y: 0 };
    private terminalCache: Map<string, TerminalBox> = new Map();
    private currentMountedId: string | null = null;
    private initializedUI = false;

    constructor(props: TerminalWindowProps) {
        super(props);
        const initialPos = props.position || { x: (window.innerWidth / 2) - 325, y: (window.innerHeight / 2) - 200 };
        this.position = { ...initialPos };
    }

    protected createRootElement(): HTMLElement {
        const pos = this.props.position || { x: (window.innerWidth / 2) - 325, y: (window.innerHeight / 2) - 200 };
        const div = document.createElement('div');
        div.className = 'terminal-window-overlay';
        div.style.position = 'fixed';
        div.style.top = `${pos.y}px`;
        div.style.left = `${pos.x}px`;
        div.style.zIndex = '10002';
        div.style.pointerEvents = 'auto';
        return div;
    }

    init() {
        this.render();
        this.setupDragging();
    }

    public focusActiveTerminal(withEnter = false) {
        if (!this.props.activeTerminalId) return;
        const box = this.terminalCache.get(this.props.activeTerminalId);
        if (box) {
            // Sequential focus attempts to handle various browser/DOM states
            box.focus();
            requestAnimationFrame(() => {
                box.focus();
                if (withEnter) {
                    box.pressEnter();
                }
            });
        }
    }

    public getStates(): Record<string, { output: string, history: string[] }> {
        const states: Record<string, { output: string, history: string[] }> = {};
        for (const [id, box] of this.terminalCache.entries()) {
            states[id] = {
                output: box.getContent(),
                history: box.getHistory()
            };
        }
        return states;
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
                this.props.onPositionChange(this.position);
            }
        });
    }

    update(props: TerminalWindowProps) {
        super.update(props);
        if (props.position && !this.isDragging && (props.position.x !== this.position.x || props.position.y !== this.position.y)) {
            this.position = { ...props.position };
            this.element.style.left = `${this.position.x}px`;
            this.element.style.top = `${this.position.y}px`;
        }
    }

    render() {
        if (!this.initializedUI) {
            this.element.innerHTML = `
                <div class="terminal-window-container">
                    <div class="terminal-window-header">
                        <div class="terminal-window-header-left">
                            ${CubeIcon(16)}
                            <span class="terminal-window-title">Terminal Manager</span>
                        </div>
                        <div class="terminal-window-header-right">
                             <div class="top-accent-toggle add-terminal-btn terminal-action-btn">
                                <span class="top-accent-text terminal-action-text">New Terminal <code class="terminal-shortcut-hint">[CTRL+SHIFT+\`]</code></span>
                                <div class="top-accent-icon-container">
                                    ${PlusIcon(12)}
                                </div>
                            </div>
                            <div class="top-accent-toggle close-window-btn terminal-action-btn">
                                 <span class="top-accent-text terminal-action-text">Hide <code class="terminal-shortcut-hint">[CTRL+J]</code></span>
                                 <div class="top-accent-icon-container">
                                     ${XIcon(12)}
                                 </div>
                            </div>
                        </div>
                    </div>
                    <div class="terminal-window-body">
                        <div class="terminal-window-left">
                            <div id="active-terminal-root" class="terminal-active-root"></div>
                        </div>
                        <div class="terminal-window-right">
                            <div class="terminal-list agent-scrollbar"></div>
                            <div class="terminal-footer-hint">
                                <span class="terminal-footer-text"><code class="terminal-footer-shortcut">[SHIFT+ARROW]</code></span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.query('.close-window-btn')?.addEventListener('click', () => this.props.onClose());
            this.query('#active-terminal-root')?.addEventListener('click', () => {
                 this.focusActiveTerminal(false);
            });
            this.query('.add-terminal-btn')?.addEventListener('click', () => this.props.onAddTerminal());
            this.initializedUI = true;
        }

        const listContainer = this.query('.terminal-list');
        if (listContainer) {
            listContainer.innerHTML = this.props.terminals.map(t => `
                <div class="terminal-list-item ${t.id === this.props.activeTerminalId ? 'active' : ''}" data-id="${t.id}">
                    <div class="terminal-item-meta">
                        <span class="terminal-item-label">bash</span>
                        <span class="terminal-item-id">[${t.id.slice(0, 4)}]</span>
                    </div>
                    <button class="delete-terminal-btn" data-id="${t.id}" title="Delete session">
                        ${XIcon(10)}
                    </button>
                </div>
            `).join('');

            listContainer.querySelectorAll('.terminal-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.getAttribute('data-id');
                    if (id) this.props.onSelectTerminal(id);
                });
            });

            listContainer.querySelectorAll('.delete-terminal-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.getAttribute('data-id');
                    if (id) this.props.onDeleteTerminal(id);
                });
            });
        }

        this.element.querySelectorAll('.terminal-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                if (id) this.props.onSelectTerminal(id);
            });
        });

        this.element.querySelectorAll('.delete-terminal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                if (id) this.props.onDeleteTerminal(id);
            });
        });

        const activeTerminal = this.props.terminals.find(t => t.id === this.props.activeTerminalId);
        const root = this.query('#active-terminal-root');
        
        const activeIds = new Set(this.props.terminals.map(t => t.id));
        for (const [id, box] of this.terminalCache.entries()) {
            if (!activeIds.has(id)) {
                box.destroy();
                this.terminalCache.delete(id);
            }
        }

        if (activeTerminal && root) {
            let termBox = this.terminalCache.get(activeTerminal.id);
            const boxProps = {
                command: activeTerminal.command || 'bash',
                output: activeTerminal.output,
                history: activeTerminal.history,
                bashSandbox: this.props.bashSandbox,
                isMinimal: false,
                hideHeader: true,
                onExit: () => this.props.onDeleteTerminal(activeTerminal.id),
                onChange: () => this.props.onStateChange()
            };

            if (!termBox) {
                termBox = new TerminalBox(boxProps);
                termBox.init();
                this.terminalCache.set(activeTerminal.id, termBox);
            } else {
                termBox.update(boxProps);
            }
            
            if (this.currentMountedId !== activeTerminal.id) {
                root.innerHTML = '';
                root.appendChild(termBox.getElement());
                this.currentMountedId = activeTerminal.id;
                
                // Critical: Trigger fit after appending to DOM to ensure correct dimensions
                setTimeout(() => {
                    if (termBox) termBox.fit();
                }, 0);
            }
        } else if (root) {
            root.innerHTML = '<div class="terminal-empty-state">No active session. Create one with + button.</div>';
        }
    }
}
