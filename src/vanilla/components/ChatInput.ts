import { BaseComponent } from '../BaseComponent';
import { StopIcon, ArrowRightIcon, CubeIcon } from './Icons';
import { ModelConfig, AgentProfile } from '../../types';
import './ChatInput.css';

interface ChatInputProps {
  isProcessing: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  placeholder?: string;
  onOpenTerminal?: () => void;
  models: ModelConfig[];
  currentModelId: string;
  onModelChange: (id: string) => void;
  agents: AgentProfile[];
  currentAgentId: string;
  onAgentChange: (id: string) => void;
  skills?: any[];
  filesystem?: Record<string, string>;
}

export class ChatInput extends BaseComponent<ChatInputProps> {
    private inputValue: string = '';
    private isModelMenuOpen: boolean = false;
    private isAgentMenuOpen: boolean = false;
    private showSuggestions: boolean = false;
    private suggestionType: '@' | '/' | null = null;
    private suggestionQuery: string = '';
    private selectedSuggestionIndex: number = 0;
    private suggestionAnchorPos: number = -1;
    private selectedModelIndex: number = 0;
    private selectedAgentIndex: number = 0;

    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        div.className = 'chat-input-wrapper';
        return div;
    }

    init() {
        this.render();
    }

    render() {
        if (!this.query('.chat-input-inner-wrapper')) {
            this.renderShell();
        }
        this.updateDynamicParts();
    }

    private renderShell() {
        const currentModel = this.props.models.find(m => m.id === this.props.currentModelId) || this.props.models[0];
        const currentAgent = this.props.agents.find(a => a.id === this.props.currentAgentId) || this.props.agents[0];

        this.element.innerHTML = `
            <div class="chat-input-inner-wrapper chat-input-group">
                <div id="suggestion-popup" class="suggestion-popup"></div>
                
                <div id="model-menu" class="model-menu-popup">
                    <div id="model-options-container" class="model-options-list"></div>
                </div>

                <div id="agent-menu" class="model-menu-popup">
                    <div id="agent-options-container" class="model-options-list"></div>
                </div>

                <div class="chat-input-container">
                    <textarea id="chat-textarea" aria-label="Message assistant..." placeholder="${this.props.placeholder || 'Ask anything, @ to mention, / for skills'}" class="chat-input-textarea"></textarea>
                    <div id="input-controls" class="input-controls-group"></div>
                </div>

                <div class="footer-controls-group">
                    <div style="position: relative">
                        <button id="btn-agent-selector" class="control-btn-secondary">
                            <div class="model-dot" style="background-color: var(--agent-accent); opacity: 0.7"></div>
                            <span id="current-agent-name">${currentAgent?.name || 'Select Agent'}</span>
                            <code class="terminal-shortcut-hint">[CTRL+SHIFT+A]</code>
                        </button>
                    </div>
                    
                    <div style="position: relative">
                        <button id="btn-model-selector" class="control-btn-secondary">
                            <div class="model-dot" style="background-color: var(--agent-accent)"></div>
                            <span id="current-model-name">${currentModel?.name || 'Select Model'}</span>
                            <code class="terminal-shortcut-hint">[CTRL+SHIFT+M]</code>
                        </button>
                    </div>

                    ${this.props.onOpenTerminal ? `
                        <button id="btn-open-terminal" class="control-btn-secondary">
                            ${CubeIcon(14)}
                            <span>Open terminal</span>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    private setupEventListeners() {
        const textarea = this.query<HTMLTextAreaElement>('#chat-textarea')!;
        const btnOpenTerminal = this.query<HTMLButtonElement>('#btn-open-terminal');
        const btnModelSelector = this.query<HTMLButtonElement>('#btn-model-selector');
        const btnAgentSelector = this.query<HTMLButtonElement>('#btn-agent-selector');

        textarea.addEventListener('input', () => {
            this.inputValue = textarea.value;
            this.updateDynamicParts();
            this.handleInputSuggestions(textarea);
        });

        textarea.addEventListener('keydown', (e) => {
            if (this.isModelMenuOpen) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.moveModelSelection(1);
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.moveModelSelection(-1);
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.applySelectedModel();
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.isModelMenuOpen = false;
                    this.render();
                    return;
                }
            }

            if (this.isAgentMenuOpen) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.moveAgentSelection(1);
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.moveAgentSelection(-1);
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.applySelectedAgent();
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.isAgentMenuOpen = false;
                    this.render();
                    return;
                }
            }

            if (this.showSuggestions) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.moveSuggestionSelection(1);
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.moveSuggestionSelection(-1);
                    return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    this.applySelectedSuggestion(textarea);
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeSuggestions();
                    return;
                }
            }

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        btnOpenTerminal?.addEventListener('click', () => this.props.onOpenTerminal?.());
        
        btnModelSelector?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isModelMenuOpen = !this.isModelMenuOpen;
            this.isAgentMenuOpen = false;
            if (this.isModelMenuOpen) {
                this.selectedModelIndex = this.props.models.findIndex(m => m.id === this.props.currentModelId);
                if (this.selectedModelIndex === -1) this.selectedModelIndex = 0;
                textarea.focus();
            }
            this.render();
        });

        btnAgentSelector?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isAgentMenuOpen = !this.isAgentMenuOpen;
            this.isModelMenuOpen = false;
            if (this.isAgentMenuOpen) {
                this.selectedAgentIndex = this.props.agents.findIndex(a => a.id === this.props.currentAgentId);
                if (this.selectedAgentIndex === -1) this.selectedAgentIndex = 0;
                textarea.focus();
            }
            this.render();
        });

        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyM') {
                e.preventDefault();
                this.isModelMenuOpen = !this.isModelMenuOpen;
                this.isAgentMenuOpen = false;
                if (this.isModelMenuOpen) {
                    this.selectedModelIndex = this.props.models.findIndex(m => m.id === this.props.currentModelId);
                    if (this.selectedModelIndex === -1) this.selectedModelIndex = 0;
                    textarea.focus();
                }
                this.render();
            }
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
                e.preventDefault();
                this.isAgentMenuOpen = !this.isAgentMenuOpen;
                this.isModelMenuOpen = false;
                if (this.isAgentMenuOpen) {
                    this.selectedAgentIndex = this.props.agents.findIndex(a => a.id === this.props.currentAgentId);
                    if (this.selectedAgentIndex === -1) this.selectedAgentIndex = 0;
                    textarea.focus();
                }
                this.render();
            }
        });

        document.addEventListener('click', (e) => {
            const isInside = this.element.contains(e.target as Node);
            if (!isInside) {
                let shouldRender = this.isModelMenuOpen || this.isAgentMenuOpen || this.showSuggestions;
                this.isModelMenuOpen = false;
                this.isAgentMenuOpen = false;
                this.closeSuggestions();
                if (shouldRender) this.render();
            }
        });
    }

    private updateDynamicParts() {
        const textarea = this.query<HTMLTextAreaElement>('#chat-textarea')!;
        const controls = this.query<HTMLElement>('#input-controls')!;
        const modelName = this.query<HTMLElement>('#current-model-name')!;
        const agentName = this.query<HTMLElement>('#current-agent-name')!;
        const modelContainer = this.query<HTMLElement>('#model-options-container')!;
        const agentContainer = this.query<HTMLElement>('#agent-options-container')!;

        if (textarea.value !== this.inputValue) {
            textarea.value = this.inputValue;
        }
        textarea.disabled = this.props.isProcessing;
        this.autoResize(textarea);

        controls.innerHTML = `
            ${this.props.isProcessing ? `
                <button id="btn-cancel" class="btn-cancel-action" title="Cancel processing">${StopIcon()}</button>
            ` : ''}
            <button id="btn-send" class="btn-send-action" disabled>${ArrowRightIcon()}</button>
        `;

        const btnSend = this.query<HTMLButtonElement>('#btn-send')!;
        const btnCancel = this.query<HTMLButtonElement>('#btn-cancel');
        
        btnSend.addEventListener('click', () => this.handleSend());
        btnCancel?.addEventListener('click', () => this.props.onCancel());
        this.updateSendButtonState(this.inputValue, btnSend);

        const currentModel = this.props.models.find(m => m.id === this.props.currentModelId) || this.props.models[0];
        if (modelName) modelName.textContent = currentModel?.name || 'Select Model';

        const currentAgent = this.props.agents.find(a => a.id === this.props.currentAgentId) || this.props.agents[0];
        if (agentName) agentName.textContent = currentAgent?.name || 'Select Agent';

        const modelMenu = this.query<HTMLElement>('#model-menu')!;
        modelMenu.style.display = this.isModelMenuOpen ? 'block' : 'none';

        const agentMenu = this.query<HTMLElement>('#agent-menu')!;
        agentMenu.style.display = this.isAgentMenuOpen ? 'block' : 'none';

        if (modelContainer) {
            modelContainer.innerHTML = this.props.models.map((m, i) => {
                const isCurrent = m.id === this.props.currentModelId;
                const isFocused = i === this.selectedModelIndex;
                return `
                    <div class="model-option ${isFocused ? 'focused' : ''}" data-id="${m.id}" data-index="${i}" style="color: ${isCurrent ? 'var(--agent-accent)' : 'var(--agent-text-main)'}">
                        <div class="model-dot" style="background-color: ${isCurrent ? 'var(--agent-accent)' : 'var(--agent-text-muted)'}"></div>
                        <span style="font-weight: ${isCurrent ? '600' : 'normal'}">${m.name}</span>
                    </div>
                `;
            }).join('');

            modelContainer.querySelectorAll('.model-option').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = el.getAttribute('data-id')!;
                    this.props.onModelChange(id);
                    this.isModelMenuOpen = false;
                    this.render();
                });
            });
        }

        if (agentContainer) {
            agentContainer.innerHTML = this.props.agents.map((a, i) => {
                const isCurrent = a.id === this.props.currentAgentId;
                const isFocused = i === this.selectedAgentIndex;
                return `
                    <div class="model-option ${isFocused ? 'focused' : ''}" data-id="${a.id}" data-index="${i}" style="color: ${isCurrent ? 'var(--agent-accent)' : 'var(--agent-text-main)'}">
                        <div class="model-dot" style="background-color: ${isCurrent ? 'var(--agent-accent)' : 'var(--agent-text-muted)'}; opacity: 0.7"></div>
                        <span style="font-weight: ${isCurrent ? '600' : 'normal'}">${a.name}</span>
                    </div>
                `;
            }).join('');

            agentContainer.querySelectorAll('.model-option').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = el.getAttribute('data-id')!;
                    this.props.onAgentChange(id);
                    this.isAgentMenuOpen = false;
                    this.render();
                });
            });
        }
    }

    private autoResize(textarea: HTMLTextAreaElement) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    private updateSendButtonState(value: string, btn: HTMLButtonElement) {
        const hasContent = value.trim().length > 0;
        btn.disabled = !hasContent || this.props.isProcessing;
        if (hasContent && !this.props.isProcessing) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    private handleSend() {
        if (!this.inputValue.trim() || this.props.isProcessing) return;
        this.props.onSend(this.inputValue);
        this.inputValue = '';
        this.closeSuggestions();
        this.render();
    }

    focus() {
        requestAnimationFrame(() => {
            this.query<HTMLTextAreaElement>('#chat-textarea')?.focus();
        });
    }

    private moveModelSelection(direction: number) {
        const count = this.props.models.length;
        if (count === 0) return;
        this.selectedModelIndex = (this.selectedModelIndex + direction + count) % count;
        this.render();
    }

    private applySelectedModel() {
        const model = this.props.models[this.selectedModelIndex];
        if (model) {
            this.props.onModelChange(model.id);
            this.isModelMenuOpen = false;
            this.render();
        }
    }

    private moveAgentSelection(direction: number) {
        const count = this.props.agents.length;
        if (count === 0) return;
        this.selectedAgentIndex = (this.selectedAgentIndex + direction + count) % count;
        this.render();
    }

    private applySelectedAgent() {
        const agent = this.props.agents[this.selectedAgentIndex];
        if (agent) {
            this.props.onAgentChange(agent.id);
            this.isAgentMenuOpen = false;
            this.render();
        }
    }

    private handleInputSuggestions(textarea: HTMLTextAreaElement) {
        const value = textarea.value;
        const pos = textarea.selectionStart;
        const textBefore = value.substring(0, pos);
        const lastAt = textBefore.lastIndexOf('@');
        const lastSlash = textBefore.lastIndexOf('/');
        const lastTrigger = Math.max(lastAt, lastSlash);
        
        if (lastTrigger !== -1) {
            const triggerChar = textBefore[lastTrigger] as '@' | '/';
            if (lastTrigger === 0 || /\s/.test(textBefore[lastTrigger - 1])) {
                const query = textBefore.substring(lastTrigger + 1);
                if (!/\s/.test(query)) {
                    this.suggestionType = triggerChar;
                    this.suggestionQuery = query;
                    this.suggestionAnchorPos = lastTrigger;
                    this.renderSuggestions();
                    return;
                }
            }
        }
        this.closeSuggestions();
    }

    private renderSuggestions() {
        const popup = this.query<HTMLElement>('#suggestion-popup')!;
        let items: any[] = [];

        if (this.suggestionType === '@') {
            const files = Object.keys(this.props.filesystem || {});
            items = files
                .filter(f => f.toLowerCase().includes(this.suggestionQuery.toLowerCase()))
                .map(f => ({ label: f, detail: 'File' }))
                .slice(0, 10);
        } else if (this.suggestionType === '/') {
            items = (this.props.skills || [])
                .filter(s => s.name.toLowerCase().includes(this.suggestionQuery.toLowerCase()))
                .map(s => ({ label: s.name, detail: s.description }))
                .slice(0, 10);
        }

        if (items.length === 0) {
            this.closeSuggestions();
            return;
        }

        this.showSuggestions = true;
        this.selectedSuggestionIndex = Math.min(this.selectedSuggestionIndex, items.length - 1);
        if (this.selectedSuggestionIndex < 0) this.selectedSuggestionIndex = 0;

        popup.style.display = 'block';
        popup.innerHTML = `
            <div id="suggestion-list" class="suggestion-list-wrapper agent-scrollbar">
                ${items.map((item, i) => `
                    <div class="suggestion-item" data-index="${i}" style="padding: 8px 12px; cursor: pointer; display: flex; flex-direction: row; align-items: center; gap: 8px; background: ${i === this.selectedSuggestionIndex ? 'var(--agent-bg-subtle)' : 'transparent'}; border-left: 2px solid ${i === this.selectedSuggestionIndex ? 'var(--agent-accent)' : 'transparent'}">
                        <div style="font-weight: 500; font-size: var(--agent-font-main); color: ${i === this.selectedSuggestionIndex ? 'var(--agent-text-main)' : 'var(--agent-text-subtle)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1">${item.label}</div>
                        ${item.detail ? `<div style="font-size: var(--agent-font-small); color: var(--agent-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50%">${item.detail}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        const activeItem = popup.querySelector(`[data-index="${this.selectedSuggestionIndex}"]`) as HTMLElement;
        if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });

        popup.querySelectorAll('.suggestion-item').forEach(el => {
            el.addEventListener('click', () => {
                this.selectedSuggestionIndex = parseInt(el.getAttribute('data-index')!);
                this.applySelectedSuggestion(this.query<HTMLTextAreaElement>('#chat-textarea')!);
            });
        });
    }

    private applySelectedSuggestion(textarea: HTMLTextAreaElement) {
        const items: any[] = []; 
        if (this.suggestionType === '@') {
            const files = Object.keys(this.props.filesystem || {});
            const filtered = files.filter(f => f.toLowerCase().includes(this.suggestionQuery.toLowerCase())).slice(0, 10);
            items.push(...filtered.map(f => ({ label: f })));
        } else {
            const filtered = (this.props.skills || []).filter(s => s.name.toLowerCase().includes(this.suggestionQuery.toLowerCase())).slice(0, 10);
            items.push(...filtered.map(s => ({ label: s.name })));
        }

        const selected = items[this.selectedSuggestionIndex];
        if (!selected) return;

        const val = textarea.value;
        const before = val.substring(0, this.suggestionAnchorPos);
        const after = val.substring(textarea.selectionStart);
        
        textarea.value = before + this.suggestionType + selected.label + ' ' + after;
        this.inputValue = textarea.value;
        this.closeSuggestions();
        this.render();
        textarea.focus();
    }

    private moveSuggestionSelection(direction: number) {
        const count = 10; 
        this.selectedSuggestionIndex = (this.selectedSuggestionIndex + direction + count) % count;
        this.renderSuggestions();
    }

    private closeSuggestions() {
        this.showSuggestions = false;
        const popup = this.query<HTMLElement>('#suggestion-popup');
        if (popup) popup.style.display = 'none';
    }
}
