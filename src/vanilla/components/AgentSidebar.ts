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
import { TerminalBox } from './TerminalBox';

// Import CSS to ensure it's bundled
import '../../AgentSidebar.css';


export class AgentSidebar extends BaseComponent<AgentSidebarProps> {
    private store: Store<AgentState>;
    private chatLogic: ChatLogic;
    private initLogic: InitializationLogic;
    private historyLogic: HistoryLogic;

    // Components
    private header: SidebarHeader | null = null;

    private messageList: MessageList | null = null;
    private chatInput: ChatInput | null = null;
    private toggleBtn: FloatingToggleButton | null = null;

    private bashSandbox: any = null;
    private llmBridge: any = null;

    constructor(props: AgentSidebarProps) {
        super(props);
        
        const initialState: AgentState = {
            messages: [],
            isProcessing: false,
            turnStartTime: null,
            hasStarted: false,
            isExpanding: false,
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
            isCollapsed: true
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
        });
    }

    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        div.className = 'agent-sidebar-layout-container collapsed';
        return div;
    }

    init() {
        // Initial setup of structural elements
        this.element.innerHTML = `
            <div class="agent-sidebar-container" style="pointer-events: auto; display: flex; flex-direction: column; height: 100%; position: relative">
                <div class="agent-panel-inner" style="flex-grow: 1; z-index: 1; display: flex; flex-direction: column; overflow: hidden">
                    <div id="header-root"></div>
                    <div id="content-root" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative">

                        <div id="message-list-root" style="flex: 1; overflow: hidden"></div>
                        <div id="chat-input-root"></div>
                    </div>
                </div>
            </div>
            <div id="overlay-root"></div>
            <div id="floating-btn-root" style="position: fixed; right: 24px; bottom: 24px; z-index: 9999"></div>
        `;

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

        if (state.isCollapsed) {
            this.element.classList.add('collapsed');
        } else {
            this.element.classList.remove('collapsed');
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
        overlayRoot.innerHTML = '';

        if (state.showHistory) {
            const historyPanel = new HistoryPanel({
                conversations: state.conversations,
                currentConversationId: state.currentConversationId,
                onSelectConversation: (id) => this.historyLogic.handleSelectConversation(id),
                onDeleteConversation: (id) => this.historyLogic.handleDeleteConversation(id),
                onClose: () => this.store.setState({ showHistory: false })
            });
            historyPanel.init();
            overlayRoot.appendChild(historyPanel.getElement());
        }

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

            const infoPanel = new InfoPanel({
                title,
                onClose: () => this.store.setState({ activeInfoPanel: null }),
                content
            });
            infoPanel.init();
            overlayRoot.appendChild(infoPanel.getElement());
        }

        // Handle "hasStarted" padding
        const panelInner = this.query<HTMLElement>('.agent-panel-inner')!;
        if (state.hasStarted) {
            panelInner.classList.remove('padded');
        } else {
            panelInner.classList.add('padded');
        }

        const footerWrapper = this.query<HTMLElement>('#chat-input-root')!;
        if (state.hasStarted) {
            footerWrapper.className = 'chat-footer-wrapper bottom';
        } else {
            footerWrapper.className = 'chat-footer-wrapper centered';
        }
    }
}
