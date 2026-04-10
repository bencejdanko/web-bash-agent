import { BaseComponent } from '../BaseComponent';
import { Store } from '../Store';
import { AgentState, ChatLogic } from '../ChatLogic';
import { InitializationLogic } from '../InitializationLogic';
import { HistoryLogic } from '../HistoryLogic';
import { AgentSidebarProps } from '../../types';

import { SidebarHeader } from './SidebarHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { FloatingToggleButton } from './FloatingToggleButton';
import { InfoPanel } from './InfoPanel';
import { HistoryPanel } from './HistoryPanel';


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
    private toggleBtn: FloatingToggleButton | null = null;
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
            sidebarSizes: savedState.sidebarSizes || [70, 30]
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
        const { bashSandbox, llmBridge } = await this.initLogic.init();
        this.bashSandbox = bashSandbox;
        this.llmBridge = llmBridge;
        this.chatLogic.setDependencies(bashSandbox, llmBridge);

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
            <div class="agent-sidebar-container" style="pointer-events: auto; display: flex; flex-direction: row; width: 100vw; height: 100vh; position: relative">
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
            <div id="floating-btn-root" style="position: fixed; right: 24px; bottom: 24px; z-index: 9999"></div>
        `;

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
            onCollapse: () => this.store.setState({ isCollapsed: true }),
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
            onOpenInTerminal: (cmd, out) => console.log('Open terminal', cmd, out), // To be implemented
            sidebarWidth: 500
        });
        this.query('#message-list-root')?.appendChild(this.messageList.getElement());

        this.chatInput = new ChatInput({
            isProcessing: false,
            onSend: (text) => this.chatLogic.handleSend(text),
            onCancel: () => this.chatLogic.handleCancel(),
            models: this.props.models,
            currentModelId: this.store.getState().currentModelId,
            onModelChange: (id) => this.initLogic.updateModel(id)
        });
        this.query('#chat-input-root')?.appendChild(this.chatInput.getElement());
        this.chatInput.init();

        this.toggleBtn = new FloatingToggleButton({
            onClick: () => this.store.setState({ isCollapsed: false })
        });
        this.query('#floating-btn-root')?.appendChild(this.toggleBtn.getElement());
        this.toggleBtn.render();

        // Initial render to reflect state
        this.render();
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
            currentModelId: state.currentModelId
        });

        // Toggle button visibility
        const floatingRoot = this.query<HTMLElement>('#floating-btn-root')!;
        floatingRoot.style.display = state.isCollapsed ? 'block' : 'none';

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

        // Sidebar is now always docked
        const panelInner = this.query<HTMLElement>('.agent-panel-inner')!;
        panelInner.classList.remove('padded');

        const footerWrapper = this.query<HTMLElement>('#chat-input-root')!;
        footerWrapper.className = 'chat-footer-wrapper bottom';
    }
}
