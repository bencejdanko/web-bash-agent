import { BaseComponent } from '../BaseComponent';
import { Store } from '../Store';
import { AgentState, ChatLogic } from '../ChatLogic';
import { InitializationLogic } from '../InitializationLogic';
import { HistoryLogic } from '../HistoryLogic';
import { AgentSidebarProps } from '../../types';

import { SidebarHeader } from './SidebarHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SidePanelRightIcon, PlusIcon } from './Icons';
import { InfoPanel } from './InfoPanel';
import { HistoryPanel } from './HistoryPanel';
import { TerminalWindow } from './TerminalWindow';
import { TerminalBox } from './TerminalBox';


// Import CSS to ensure it's bundled
import '../../AgentSidebar.css';
import Split from 'split.js';


export class AgentSidebar extends BaseComponent<AgentSidebarProps> {
    private store: Store<AgentState>;
    private chatLogic: ChatLogic;
    private initLogic: InitializationLogic;
    private historyLogic: HistoryLogic;

    // Components
    private header: SidebarHeader | null = null;

    private messageList: MessageList | null = null;
    private chatInput: ChatInput | null = null;
    private historyPanel: HistoryPanel | null = null;
    private infoPanel: InfoPanel | null = null;
    private terminalWindow: TerminalWindow | null = null;
    private splitInstance: any = null;

    private bashSandbox: any = null;
    private llmBridge: any = null;

    constructor(props: AgentSidebarProps) {
        super(props);
        
        const storageKey = 'agent-sidebar-state';
        const savedState = JSON.parse(localStorage.getItem(storageKey) || '{}');

        const initialState: AgentState = {
            messages: [],
            isProcessing: false,
            turnStartTime: null,
            hasStarted: false,

            collapsedTurnIds: [],
            collapsedThoughtIds: [],
            currentModelId: props.initialModelId || props.models[0]?.id,
            actualFilesystem: props.filesystem || {},
            terminals: [],
            activeTerminalId: null,
            activeInfoPanel: null,
            showHistory: false,
            conversations: [],
            currentConversationId: null,
            isInitializing: true,
            isCollapsed: savedState.isCollapsed !== undefined ? savedState.isCollapsed : true,
            sidebarSizes: savedState.sidebarSizes || [70, 30],
            skills: props.skills || [],
            showTerminalWindow: false
        };

        this.store = new Store(initialState);
        this.chatLogic = new ChatLogic(this.store, props);
        this.initLogic = new InitializationLogic(this.store, props);
        this.historyLogic = new HistoryLogic(this.store);

        this.store.subscribe((state) => this.render());
        
        this.setup();
    }

    private async setup() {
        this.historyLogic.loadHistory();
        const { bashSandbox, llmBridge, skills } = await this.initLogic.init();
        this.bashSandbox = bashSandbox;
        this.llmBridge = llmBridge;
        this.chatLogic.setDependencies(bashSandbox, llmBridge);

        if (skills) {
            this.store.setState({ skills });
        }

        // Sync history whenever messages change
        this.store.subscribe((state) => {
            this.historyLogic.saveCurrentChat(state.messages);
            
            // Persist UI state
            localStorage.setItem('agent-sidebar-state', JSON.stringify({
                isCollapsed: state.isCollapsed,
                sidebarSizes: state.sidebarSizes
            }));
        });

        this.store.setState({ isInitializing: false });
    }

    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        div.className = 'agent-sidebar-layout-container';
        
        // Apply saved collapsed state immediately to avoid flicker
        try {
            const saved = JSON.parse(localStorage.getItem('agent-sidebar-state') || '{}');
            if (saved.isCollapsed === false) {
                div.classList.remove('collapsed');
            } else {
                div.classList.add('collapsed');
            }
        } catch (e) {
            div.classList.add('collapsed');
        }

        return div;
    }

    init() {
        // Initial setup of structural elements
        this.element.innerHTML = `
            <div id="top-accent-header" class="top-accent-header">
                <div style="display: flex; align-items: center; gap: 0">
                    <div id="top-accent-toggle" class="top-accent-toggle">
                        <span class="top-accent-text">Toggle Agent</span>
                        <div class="top-accent-icon-container">
                            ${SidePanelRightIcon('var(--agent-top-header-icon-size)')}
                        </div>
                    </div>
                    <div class="header-divider" style="width: 1px; height: 16px; background: rgba(255,255,255,0.1); margin: 0 4px"></div>
                    <div id="terminal-window-toggle" class="top-accent-toggle">
                        <span class="top-accent-text">New Terminal</span>
                        <div class="top-accent-icon-container">
                            ${PlusIcon(14)}
                        </div>
                    </div>
                </div>
            </div>
            <div class="agent-sidebar-container">
                <div id="sidebar-spacer" style="flex-grow: 1; pointer-events: none"></div>
                <div id="sidebar-main" class="agent-panel-inner" style="z-index: 1; display: flex; flex-direction: column; overflow: hidden; position: relative">
                    <div id="header-root"></div>
                    <div id="content-root" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative">
                        <div id="message-list-root" style="flex: 1; overflow: hidden"></div>
                        <div id="chat-input-root"></div>
                    </div>
                    <div id="overlay-root" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 100"></div>
                </div>
            </div>
            <div id="global-overlay-root" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 10002"></div>
        `;

        // Add click listener for the top accent toggle control
        this.query('#top-accent-toggle')?.addEventListener('click', () => {
            this.store.setState({ isCollapsed: !this.store.getState().isCollapsed });
        });

        this.query('#terminal-window-toggle')?.addEventListener('click', () => {
            const state = this.store.getState();
            if (!state.showTerminalWindow && state.terminals.length === 0) {
                this.handleAddTerminal();
            }
            this.store.setState({ showTerminalWindow: !state.showTerminalWindow });
        });

        // Initialize Split.js
        const spacer = this.query('#sidebar-spacer')!;
        const main = this.query('#sidebar-main')!;

        this.splitInstance = Split([spacer, main], {
            sizes: this.store.getState().sidebarSizes,
            minSize: [0, 320],
            gutterSize: 8,
            cursor: 'col-resize',
            direction: 'horizontal',
            onDrag: (sizes) => {
                const width = main.getBoundingClientRect().width;
                this.store.setState({ sidebarSizes: sizes });
                this.messageList?.update({ sidebarWidth: width });
            }
        });

        this.header = new SidebarHeader({
            onNewChat: () => this.historyLogic.handleNewChat(),
            onToggleHistory: () => this.store.setState(s => ({ showHistory: !s.showHistory, activeInfoPanel: null })),
            onToggleTools: () => this.store.setState(s => ({ activeInfoPanel: s.activeInfoPanel === 'tools' ? null : 'tools', showHistory: false })),
            onToggleRegistry: () => this.store.setState(s => ({ activeInfoPanel: s.activeInfoPanel === 'mcp' ? null : 'mcp', showHistory: false })),
            onToggleSystem: () => this.store.setState(s => ({ activeInfoPanel: s.activeInfoPanel === 'system' ? null : 'system', showHistory: false }))
        });
        this.query('#header-root')?.appendChild(this.header.getElement());
        this.header.render();

        this.messageList = new MessageList({
            messages: [],
            isProcessing: false,
            turnStartTime: null,
            collapsedTurnIds: [],
            collapsedThoughtIds: [],
            onToggleTurn: (id) => this.store.setState(s => ({ collapsedTurnIds: s.collapsedTurnIds.includes(id) ? s.collapsedTurnIds.filter(x => x !== id) : [...s.collapsedTurnIds, id] })),
            onToggleThought: (id) => this.store.setState(s => ({ collapsedThoughtIds: s.collapsedThoughtIds.includes(id) ? s.collapsedThoughtIds.filter(x => x !== id) : [...s.collapsedThoughtIds, id] })),
            onOpenInTerminal: (cmd, out) => {
                const id = `term-${Date.now()}`;
                this.store.setState(s => ({
                    terminals: [...s.terminals, { id, command: cmd, output: out }],
                    activeTerminalId: id,
                    showTerminalWindow: true
                }));
            },
            sidebarWidth: 500
        });
        this.query('#message-list-root')?.appendChild(this.messageList.getElement());

        this.chatInput = new ChatInput({
            isProcessing: false,
            onSend: (text) => this.chatLogic.handleSend(text),
            onCancel: () => this.chatLogic.handleCancel(),
            models: this.props.models,
            currentModelId: this.store.getState().currentModelId,
            onModelChange: (id) => this.initLogic.updateModel(id),
            skills: this.props.skills,
            filesystem: this.store.getState().actualFilesystem
        });
        this.query('#chat-input-root')?.appendChild(this.chatInput.getElement());
        this.chatInput.init();

        // Initial render to reflect state
        this.render();
    }

    private handleAddTerminal() {
        const id = `term-${Date.now()}`;
        this.store.setState(s => ({
            terminals: [...s.terminals, { id, command: 'bash' }],
            activeTerminalId: id,
            showTerminalWindow: true
        }));
    }

    private handleSelectTerminal(id: string) {
        this.store.setState({ activeTerminalId: id });
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
    }

    render() {
        if (!this.header) return;

        const state = this.store.getState();

        const gutter = this.query('.gutter');
        if (state.isCollapsed) {
            this.element.classList.add('collapsed');
            if (gutter) (gutter as HTMLElement).style.display = 'none';
        } else {
            this.element.classList.remove('collapsed');
            if (gutter) (gutter as HTMLElement).style.display = 'block';
        }

        // Update subcomponents
        this.messageList?.update({
            messages: state.messages,
            isProcessing: state.isProcessing,
            turnStartTime: state.turnStartTime,
            collapsedTurnIds: state.collapsedTurnIds,
            collapsedThoughtIds: state.collapsedThoughtIds,
            bashSandbox: this.bashSandbox
        });

        this.chatInput?.update({
            isProcessing: state.isProcessing,
            currentModelId: state.currentModelId,
            skills: state.skills,
            filesystem: state.actualFilesystem
        });

        if (state.isInitializing) {
            // Show loading state if needed
            return;
        }

        // Overlays
        const overlayRoot = this.query<HTMLElement>('#overlay-root')!;
        
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
            let title = '';
            let content: HTMLElement | HTMLElement[] = document.createElement('div');
            
            if (state.activeInfoPanel === 'system') {
                title = 'System Information';
                const pre = document.createElement('pre');
                Object.assign(pre.style, {
                    padding: '12px',
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    overflowY: 'auto'
                });
                pre.textContent = this.props.systemPrompt;
                content = pre;
            } else if (state.activeInfoPanel === 'tools') {
                title = 'Agent Tools & Skills';
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.flexDirection = 'column';
                div.style.gap = '8px';
                
                this.llmBridge?.tools?.forEach((tool: any) => {
                    const def = tool.definition?.function || tool;
                    const item = document.createElement('div');
                    Object.assign(item.style, {
                        padding: '12px',
                        backgroundColor: 'var(--agent-bg-subtle)',
                        borderRadius: '8px',
                        border: '1px solid var(--agent-border-main)'
                    });
                    item.innerHTML = `
                        <div style="font-weight: 600; font-size: 13px; color: var(--agent-text-main); margin-bottom: 4px; font-family: 'JetBrains Mono'">${def.name}</div>
                        <div style="font-size: 12px; color: var(--agent-text-muted); line-height: 1.5">${def.description}</div>
                    `;
                    div.appendChild(item);
                });
                content = div;
            } else if (state.activeInfoPanel === 'mcp') {
                title = 'MCP Extensions';
                const div = document.createElement('div');
                div.innerHTML = `<div style="font-size: 12px; color: var(--agent-text-muted); font-style: italic">MCP info panel coming soon...</div>`;
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
        } else if (this.infoPanel) {
            this.infoPanel.getElement().remove();
            this.infoPanel = null;
        }

        // Handle Terminal Window
        const globalOverlayRoot = this.query<HTMLElement>('#global-overlay-root')!;
        if (state.showTerminalWindow) {
            const termProps = {
                terminals: state.terminals,
                activeTerminalId: state.activeTerminalId,
                onSelectTerminal: (id: string) => this.handleSelectTerminal(id),
                onDeleteTerminal: (id: string) => this.handleDeleteTerminal(id),
                onAddTerminal: () => this.handleAddTerminal(),
                onClose: () => this.store.setState({ showTerminalWindow: false }),
                bashSandbox: this.bashSandbox
            };

            if (!this.terminalWindow) {
                this.terminalWindow = new TerminalWindow(termProps);
                this.terminalWindow.init();
                globalOverlayRoot.appendChild(this.terminalWindow.getElement());
            } else {
                this.terminalWindow.update(termProps);
            }
        } else if (this.terminalWindow) {
            this.terminalWindow.getElement().remove();
            this.terminalWindow = null;
        }

        // Sidebar is now always docked
        const panelInner = this.query<HTMLElement>('.agent-panel-inner')!;
        panelInner.classList.remove('padded');

        const messageListRoot = this.query<HTMLElement>('#message-list-root')!;
        const footerWrapper = this.query<HTMLElement>('#chat-input-root')!;
        
        if (state.messages.length === 0) {
            messageListRoot.style.display = 'none';
            footerWrapper.className = 'chat-footer-wrapper centered';
        } else {
            messageListRoot.style.display = 'block';
            footerWrapper.className = 'chat-footer-wrapper bottom';
        }
    }
}
