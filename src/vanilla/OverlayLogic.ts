import { Store } from './Store';
import { AgentState } from './ChatLogic';
import { HistoryPanel } from './components/HistoryPanel';
import { InfoPanel } from './components/InfoPanel';
import { TerminalWindow } from './components/TerminalWindow';
import { HistoryLogic } from './HistoryLogic';
import { PersistentBashSandbox } from './PersistentBashSandbox';

export class OverlayLogic {
    private store: Store<AgentState>;
    private historyLogic: HistoryLogic;
    private bashSandbox: PersistentBashSandbox;
    
    private historyPanel: HistoryPanel | null = null;
    private infoPanel: InfoPanel | null = null;
    private terminalWindow: TerminalWindow | null = null;

    constructor(store: Store<AgentState>, historyLogic: HistoryLogic, bashSandbox: PersistentBashSandbox) {
        this.store = store;
        this.historyLogic = historyLogic;
        this.bashSandbox = bashSandbox;
    }

    public renderOverlays(overlayRoot: HTMLElement, globalOverlayRoot: HTMLElement | null, tools: any[], systemPrompt: string) {
        const state = this.store.getState();

        // Handle History Panel
        if (state.showHistory) {
            const historyProps = {
                conversations: state.conversations,
                currentConversationId: state.currentConversationId,
                onSelectConversation: (id: string) => {
                    this.historyLogic.handleSelectConversation(id);
                    this.store.setState({ showHistory: false });
                },
                onDeleteConversation: (id: string) => this.historyLogic.handleDeleteConversation(id),
                onClose: () => this.store.setState({ showHistory: false })
            };

            if (!this.historyPanel) {
                this.historyPanel = new HistoryPanel(historyProps);
                this.historyPanel.init();
                overlayRoot.appendChild(this.historyPanel.getElement());
            } else {
                this.historyPanel.update(historyProps);
            }
        } else if (this.historyPanel) {
            this.historyPanel.getElement().remove();
            this.historyPanel = null;
        }

        // Handle Info Panel
        if (state.activeInfoPanel) {
            this.renderInfoPanel(overlayRoot, state, tools, systemPrompt);
        } else if (this.infoPanel) {
            this.infoPanel.getElement().remove();
            this.infoPanel = null;
        }

        // Handle Terminal Window
        if (globalOverlayRoot) {
            this.renderTerminalWindow(globalOverlayRoot, state);
        }
    }

    private renderInfoPanel(overlayRoot: HTMLElement, state: any, tools: any[], systemPrompt: string) {
        let title = '';
        let content: HTMLElement | HTMLElement[] = document.createElement('div');
        
        if (state.activeInfoPanel === 'system') {
            title = 'System Information';
            const pre = document.createElement('pre');
            pre.className = 'info-panel-system-prompt';
            pre.textContent = systemPrompt;
            content = pre;
        } else if (state.activeInfoPanel === 'tools') {
            title = 'Agent Tools & Skills';
            const div = document.createElement('div');
            div.className = 'info-panel-tools-list';
            
            tools?.forEach((tool: any) => {
                const def = tool.definition?.function || tool;
                const item = document.createElement('div');
                item.className = 'info-panel-tool-item';
                item.innerHTML = `
                    <div class="info-panel-tool-name">${def.name}</div>
                    <div class="info-panel-tool-description">${def.description}</div>
                `;
                div.appendChild(item);
            });
            content = div;
        } else if (state.activeInfoPanel === 'mcp') {
            title = 'MCP Extensions';
            const div = document.createElement('div');
            div.innerHTML = `<div class="info-panel-empty-state">MCP info panel coming soon...</div>`;
            content = div;
        }

        const infoProps = {
            title,
            onClose: () => this.store.setState({ activeInfoPanel: null }),
            content
        };

        if (!this.infoPanel) {
            this.infoPanel = new InfoPanel(infoProps);
            this.infoPanel.init();
            overlayRoot.appendChild(this.infoPanel.getElement());
        } else {
            this.infoPanel.update(infoProps);
        }
    }

    private renderTerminalWindow(globalOverlayRoot: HTMLElement, state: any) {
        const termProps = {
            terminals: state.terminals,
            activeTerminalId: state.activeTerminalId,
            onSelectTerminal: (id: string) => this.handleSelectTerminal(id),
            onDeleteTerminal: (id: string) => this.handleDeleteTerminal(id),
            onAddTerminal: () => this.handleAddTerminal(),
            onClose: () => {
                this.saveTerminalStates();
                this.store.setState({ showTerminalWindow: false });
            },
            onStateChange: () => this.saveTerminalStates(),
            bashSandbox: this.bashSandbox,
            position: state.terminalPosition,
            onPositionChange: (pos: { x: number, y: number }) => this.store.setState({ terminalPosition: pos })
        };

        if (!this.terminalWindow) {
            this.terminalWindow = new TerminalWindow(termProps);
            this.terminalWindow.init();
            globalOverlayRoot.appendChild(this.terminalWindow.getElement());
        } else {
            this.terminalWindow.update(termProps);
        }
        
        this.terminalWindow.getElement().style.display = state.showTerminalWindow ? 'block' : 'none';
    }

    private handleSelectTerminal(id: string) {
        this.store.setState({ activeTerminalId: id });
        requestAnimationFrame(() => {
            setTimeout(() => {
                this.terminalWindow?.focusActiveTerminal(false);
            }, 50);
        });
    }

    private handleAddTerminal() {
        const newId = Math.random().toString(36).substring(7);
        const newTerminal = { id: newId, command: 'bash', output: '' };
        this.store.setState(s => ({
            terminals: [...s.terminals, newTerminal],
            activeTerminalId: newId,
            showTerminalWindow: true
        }));
        requestAnimationFrame(() => {
            setTimeout(() => {
                this.terminalWindow?.focusActiveTerminal(false);
            }, 50);
        });
    }

    private handleDeleteTerminal(id: string) {
        const state = this.store.getState();
        const newTerminals = state.terminals.filter(t => t.id !== id);
        let newActiveId = state.activeTerminalId;

        if (state.activeTerminalId === id) {
            newActiveId = newTerminals.length > 0 ? newTerminals[newTerminals.length - 1].id : null;
        }

        this.store.setState({
            terminals: newTerminals,
            activeTerminalId: newActiveId
        });

        if (newActiveId) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    this.terminalWindow?.focusActiveTerminal(false);
                }, 50);
            });
        }
    }

    private saveTerminalStates() {
        if (!this.terminalWindow) return;
        const states = this.terminalWindow.getStates();
        this.store.setState(s => ({
            terminals: s.terminals.map(t => states[t.id] !== undefined ? { ...t, ...states[t.id] } : t),
            terminalCwd: this.bashSandbox.getCwd(),
            terminalEnv: this.bashSandbox.getEnv()
        }));
    }

    public getTerminalWindow() {
        return this.terminalWindow;
    }
}
