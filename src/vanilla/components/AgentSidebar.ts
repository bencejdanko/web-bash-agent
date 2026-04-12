import { BaseComponent } from '../BaseComponent';
import { Store } from '../Store';
import { AgentState, ChatLogic } from '../ChatLogic';
import { InitializationLogic } from '../InitializationLogic';
import { HistoryLogic } from '../HistoryLogic';
import { OverlayLogic } from '../OverlayLogic';
import { AgentSidebarProps } from '../../types';

import { SidebarHeader } from './SidebarHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SidePanelRightIcon, PlusIcon } from './Icons';

// Import CSS to ensure it's bundled
import '../../AgentSidebar.css';
import Split from 'split.js';


export class AgentSidebar extends BaseComponent<AgentSidebarProps> {
    private store: Store<AgentState>;
    private chatLogic: ChatLogic;
    private initLogic: InitializationLogic;
    private historyLogic: HistoryLogic;
    private overlayLogic: OverlayLogic | null = null;

    // Components
    private header: SidebarHeader | null = null;
    private messageList: MessageList | null = null;
    private chatInput: ChatInput | null = null;
    private splitInstance: any = null;

    private bashSandbox: any = null;
    private llmBridge: any = null;

    constructor(props: AgentSidebarProps) {
        super(props);
        
        const storageKey = 'agent-sidebar-state';
        const savedState = JSON.parse(localStorage.getItem(storageKey) || '{}');

        let initialModelId = savedState.currentModelId;
        if (initialModelId && !props.models.some(m => m.id === initialModelId)) {
            initialModelId = undefined;
        }

        const initialState: AgentState = {
            messages: [],
            isProcessing: false,
            turnStartTime: null,
            hasStarted: false,

            collapsedTurnIds: [],
            collapsedThoughtIds: [],
            currentModelId: initialModelId || props.initialModelId || props.models[0]?.id,
            actualFilesystem: props.filesystem || {},
            activeInfoPanel: null,
            showHistory: false,
            conversations: [],
            currentConversationId: null,
            isInitializing: true,
            isCollapsed: savedState.isCollapsed !== undefined ? savedState.isCollapsed : true,
            sidebarSizes: savedState.sidebarSizes || [70, 30],
            skills: props.skills || [],
            showTerminalWindow: savedState.showTerminalWindow || false,
            terminalPosition: savedState.terminalPosition || null,
            terminals: savedState.terminals || [],
            activeTerminalId: savedState.activeTerminalId || null
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
        
        this.overlayLogic = new OverlayLogic(this.store, this.historyLogic, bashSandbox);

        if (skills) {
            this.store.setState({ skills });
        }

        // Sync history whenever messages change
        this.store.subscribe((state) => {
            this.historyLogic.saveCurrentChat(state.messages);
            
            // Persist UI state
            localStorage.setItem('agent-sidebar-state', JSON.stringify({
                isCollapsed: state.isCollapsed,
                sidebarSizes: state.sidebarSizes,
                currentModelId: state.currentModelId,
                showTerminalWindow: state.showTerminalWindow,
                terminalPosition: state.terminalPosition,
                terminals: state.terminals,
                activeTerminalId: state.activeTerminalId
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
                <div class="top-accent-group">
                    <div id="top-accent-toggle" class="top-accent-toggle">
                        <span class="top-accent-text">Toggle Agent <code class="terminal-shortcut-hint">[CTRL+ALT+B]</code></span>
                        <div class="top-accent-icon-container">
                            ${SidePanelRightIcon('var(--agent-top-header-icon-size)')}
                        </div>
                    </div>
                    <div class="header-divider"></div>
                    <div id="terminal-window-toggle" class="top-accent-toggle">
                        <span class="top-accent-text">New Terminal <code class="terminal-shortcut-hint">[CTRL+SHIFT+\`]</code></span>
                        <div class="top-accent-icon-container">
                            ${PlusIcon(14)}
                        </div>
                    </div>
                </div>
            </div>
            <div class="agent-sidebar-container">
                <div id="sidebar-spacer" style="flex-grow: 1; pointer-events: none"></div>
                <div id="sidebar-main" class="agent-panel-inner sidebar-main-panel">
                    <div id="header-root"></div>
                    <div id="content-root" class="sidebar-content-wrapper">
                        <div id="message-list-root" style="flex: 1; overflow: hidden"></div>
                        <div id="chat-input-root"></div>
                    </div>
                    <div id="overlay-root" class="overlay-container"></div>
                </div>
            </div>
            <div id="global-overlay-root" class="global-overlay-container"></div>
        `;

        // Add click listener for the top accent toggle control
        this.query('#top-accent-toggle')?.addEventListener('click', () => {
            this.store.setState({ isCollapsed: !this.store.getState().isCollapsed });
        });

        this.query('#terminal-window-toggle')?.addEventListener('click', () => {
            this.handleTerminalToggle();
        });

        // Add global keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.code === 'KeyB') {
                e.preventDefault();
                this.store.setState({ isCollapsed: !this.store.getState().isCollapsed });
            }
            if (e.ctrlKey && e.shiftKey && e.code === 'Backquote') {
                e.preventDefault();
                this.handleTerminalToggle();
            }
            if (e.ctrlKey && e.code === 'KeyJ') {
                e.preventDefault();
                this.saveTerminalStates();
                this.store.setState({ showTerminalWindow: false });
            }
            if (e.shiftKey && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
                const state = this.store.getState();
                if (state.showTerminalWindow && state.terminals.length > 1) {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    const currentIndex = state.terminals.findIndex(t => t.id === state.activeTerminalId);
                    if (currentIndex === -1) return;

                    let nextIndex = currentIndex;
                    if (e.code === 'ArrowUp') {
                        nextIndex = (currentIndex - 1 + state.terminals.length) % state.terminals.length;
                    } else {
                        nextIndex = (currentIndex + 1) % state.terminals.length;
                    }
                    
                    const nextId = state.terminals[nextIndex].id;
                    this.store.setState({ activeTerminalId: nextId });
                    
                    requestAnimationFrame(() => {
                        this.overlayLogic?.getTerminalWindow()?.focusActiveTerminal(false);
                    });
                }
            }
        }, true);

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

        this.render();
    }

    private handleTerminalToggle() {
        const state = this.store.getState();
        if (!state.showTerminalWindow) {
            if (state.terminals.length === 0) {
                this.handleAddTerminal();
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        this.overlayLogic?.getTerminalWindow()?.focusActiveTerminal(true);
                    }, 150);
                });
            } else {
                this.store.setState({ showTerminalWindow: true });
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        this.overlayLogic?.getTerminalWindow()?.focusActiveTerminal(false);
                    }, 50);
                });
            }
        } else {
            this.handleAddTerminal();
            requestAnimationFrame(() => {
                setTimeout(() => {
                    this.overlayLogic?.getTerminalWindow()?.focusActiveTerminal(true);
                }, 50);
            });
        }
    }

    private saveTerminalStates() {
        const window = this.overlayLogic?.getTerminalWindow();
        if (!window) return;
        const states = window.getStates();
        const currentTerminals = this.store.getState().terminals;
        const updatedTerminals = currentTerminals.map(t => ({
            ...t,
            output: states[t.id] || t.output
        }));
        this.store.setState({ terminals: updatedTerminals });
    }

    private handleAddTerminal() {
        const id = `term-${Date.now()}`;
        this.store.setState(s => ({
            terminals: [...s.terminals, { id, command: 'bash' }],
            activeTerminalId: id,
            showTerminalWindow: true
        }));
    }

    render() {
        if (!this.header || !this.overlayLogic) return;

        const state = this.store.getState();
        const gutter = this.query('.gutter');
        if (state.isCollapsed) {
            this.element.classList.add('collapsed');
            if (gutter) (gutter as HTMLElement).style.display = 'none';
        } else {
            this.element.classList.remove('collapsed');
            if (gutter) (gutter as HTMLElement).style.display = 'block';
        }

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

        if (state.isInitializing) return;

        const overlayRoot = this.query<HTMLElement>('#overlay-root')!;
        const globalOverlayRoot = this.query<HTMLElement>('#global-overlay-root');
        
        this.overlayLogic.renderOverlays(
            overlayRoot, 
            globalOverlayRoot, 
            this.llmBridge?.tools, 
            this.props.systemPrompt
        );

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
