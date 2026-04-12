import { BaseComponent } from '../BaseComponent';
import { StopIcon, ArrowRightIcon, CubeIcon } from './Icons';
import { ModelConfig } from '../../types';
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
  skills?: any[];
  filesystem?: Record<string, string>;
}

export class ChatInput extends BaseComponent<ChatInputProps> {
    private inputValue: string = '';
    private isModelMenuOpen: boolean = false;
    private showSuggestions: boolean = false;
    private suggestionType: '@' | '/' | null = null;
    private suggestionQuery: string = '';
    private selectedSuggestionIndex: number = 0;
    private suggestionAnchorPos: number = -1;
    private selectedModelIndex: number = 0;

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

        this.element.innerHTML = `
            <div class="chat-input-inner-wrapper chat-input-group">
                <div id="suggestion-popup" class="suggestion-popup"></div>
                <div id="model-menu" class="model-menu-popup">
                    <div id="model-options-container" class="model-options-list"></div>
                </div>
                <div class="chat-input-container">
                    <textarea id="chat-textarea" aria-label="Message assistant..." placeholder="${this.props.placeholder || 'Ask anything, @ to mention, / for skills'}" class="chat-input-textarea"></textarea>
                    <div id="input-controls" class="input-controls-group"></div>
                </div>

                <div class="footer-controls-group">
                    ${this.props.onOpenTerminal ? `
                        <button id="btn-open-terminal" class="control-btn-secondary">
                            ${CubeIcon(14)}
                            <span>Open terminal</span>
                        </button>
                    ` : ''}
                    
                    <div style="position: relative">
                        <button id="btn-model-selector" class="control-btn-secondary">
                            <div class="model-dot" style="background-color: var(--agent-accent)"></div>
                            <span id="current-model-name">${currentModel?.name || 'Select Model'}</span>
                            <code class="terminal-shortcut-hint">[CTRL+SHIFT+M]</code>
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    private setupEventListeners() {
        const textarea = this.query<HTMLTextAreaElement>('#chat-textarea')!;
        const btnOpenTerminal = this.query<HTMLButtonElement>('#btn-open-terminal');
        const btnModelSelector = this.query<HTMLButtonElement>('#btn-model-selector');

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
            if (this.isModelMenuOpen) {
                this.selectedModelIndex = this.props.models.findIndex(m => m.id === this.props.currentModelId);
                if (this.selectedModelIndex === -1) this.selectedModelIndex = 0;
                textarea.focus();
            }
            this.render();
        });

        btnModelSelector?.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
                e.preventDefault();
                if (!this.isModelMenuOpen) {
                    this.isModelMenuOpen = true;
                    this.selectedModelIndex = this.props.models.findIndex(m => m.id === this.props.currentModelId);
                    if (this.selectedModelIndex === -1) this.selectedModelIndex = 0;
                    this.render();
                }
                textarea.focus();
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.code === 'KeyM') {
                e.preventDefault();
                this.isModelMenuOpen = !this.isModelMenuOpen;
                if (this.isModelMenuOpen) {
                    this.selectedModelIndex = this.props.models.findIndex(m => m.id === this.props.currentModelId);
                    if (this.selectedModelIndex === -1) this.selectedModelIndex = 0;
                    textarea.focus();
                }
                this.render();
            }
        });

        document.addEventListener('click', (e) => {
            const isInside = this.element.contains(e.target as Node);
            if (!isInside) {
                let shouldRender = this.isModelMenuOpen || this.showSuggestions;
                this.isModelMenuOpen = false;
                this.closeSuggestions();
                if (shouldRender) this.render();
            }
        });
    }

    private updateDynamicParts() {
        const textarea = this.query<HTMLTextAreaElement>('#chat-textarea')!;
        const controls = this.query<HTMLElement>('#input-controls')!;
        const modelName = this.query<HTMLElement>('#current-model-name')!;
        const modelContainer = this.query<HTMLElement>('#model-options-container')!;

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

        const modelMenu = this.query<HTMLElement>('#model-menu')!;
        modelMenu.style.display = this.isModelMenuOpen ? 'block' : 'none';

        if (modelContainer) {
            modelContainer.innerHTML = this.props.models.map((m, i) => {
                const isCurrent = m.id === this.props.currentModelId;
                const isFocused = i === this.selectedModelIndex;
                const bgColor = isFocused ? 'var(--agent-bg-subtle)' : 'transparent';
                const textColor = isCurrent ? 'var(--agent-accent)' : 'var(--agent-text-main)';
                const dotColor = isCurrent ? 'var(--agent-accent)' : (isFocused ? 'var(--agent-border-main)' : 'transparent');
                
                return `
                    <div class="model-option" data-id="${m.id}" data-index="${i}" style="padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: var(--agent-font-main); color: ${textColor}; background-color: ${bgColor}; display: flex; align-items: center; gap: 8px; transition: all 0.15s ease">
                        <div class="model-dot" style="background-color: ${dotColor}; border: ${isCurrent ? 'none' : '1px solid var(--agent-border-main)'}"></div>
                        <div style="flex-grow: 1">${m.name}</div>
                    </div>
                `;
            }).join('');

            if (this.isModelMenuOpen) {
                const focusedItem = modelContainer.querySelector(`[data-index="${this.selectedModelIndex}"]`) as HTMLElement;
                if (focusedItem) focusedItem.scrollIntoView({ block: 'nearest' });
            }

            modelContainer.querySelectorAll('.model-option').forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = (opt as HTMLElement).dataset.id;
                    if (id) {
                        this.props.onModelChange(id);
                        this.isModelMenuOpen = false;
                        this.render();
                    }
                });
            });
        }
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
                this.selectedSuggestionIndex = parseInt((el as HTMLElement).dataset.index!);
                this.applySelectedSuggestion(this.query<HTMLTextAreaElement>('#chat-textarea')!);
            });
        });
    }

    private moveSuggestionSelection(direction: number) {
        const popup = this.query<HTMLElement>('#suggestion-popup')!;
        const items = popup.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;
        this.selectedSuggestionIndex = (this.selectedSuggestionIndex + direction + items.length) % items.length;
        this.renderSuggestions();
    }

    private applySelectedSuggestion(textarea: HTMLTextAreaElement) {
        const popup = this.query<HTMLElement>('#suggestion-popup')!;
        const items = Array.from(popup.querySelectorAll('.suggestion-item')) as HTMLElement[];
        if (items.length === 0 || this.selectedSuggestionIndex >= items.length) return;

        const label = items[this.selectedSuggestionIndex].querySelector('div')!.textContent!;
        const textBefore = textarea.value.substring(0, this.suggestionAnchorPos);
        const textAfter = textarea.value.substring(textarea.selectionStart);
        
        const prefix = this.suggestionType === '/' ? '/skill:' : '@file:';
        const insertedText = prefix + label + ' ';
        const newValue = textBefore + insertedText + textAfter;
        
        textarea.value = newValue;
        this.inputValue = newValue;
        
        const newPos = this.suggestionAnchorPos + insertedText.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
        this.closeSuggestions();
        this.autoResize(textarea);
    }

    private closeSuggestions() {
        this.showSuggestions = false;
        this.suggestionType = null;
        this.suggestionQuery = '';
        this.selectedSuggestionIndex = 0;
        this.suggestionAnchorPos = -1;
        const popup = this.query<HTMLElement>('#suggestion-popup');
        if (popup) popup.style.display = 'none';
    }

    private updateSendButtonState(val: string, btn: HTMLButtonElement) {
        const hasText = val.trim().length > 0;
        if (hasText && !this.props.isProcessing) {
            btn.disabled = false;
            btn.style.backgroundColor = 'var(--agent-bg-dark)';
            btn.style.color = 'var(--agent-text-white)';
            btn.style.cursor = 'pointer';
            btn.style.transform = 'scale(1)';
        } else {
            btn.disabled = true;
            btn.style.backgroundColor = 'var(--agent-bg-subtle)';
            btn.style.color = 'var(--agent-text-muted)';
            btn.style.cursor = 'default';
            btn.style.transform = 'scale(0.9)';
        }
    }

    private autoResize(textarea: HTMLTextAreaElement) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }

    private handleSend() {
        if (!this.inputValue.trim() || this.props.isProcessing) return;
        this.props.onSend(this.inputValue);
        this.inputValue = '';
        this.render();
    }
}
