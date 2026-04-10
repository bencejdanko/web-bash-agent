import { BaseComponent } from '../BaseComponent';
import { StopIcon, ArrowRightIcon, CubeIcon } from './Icons';
import { ModelConfig } from '../../types';

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

    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        div.style.width = '100%';
        div.style.flexShrink = '0';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'center';
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
            <div class="chat-input-inner-wrapper" style="display: flex; flex-direction: column; gap: 8px; width: 100%; position: relative">
                <div id="suggestion-popup" style="display: none; position: absolute; bottom: 100%; left: 0; right: 0; margin-bottom: 8px; background: var(--agent-bg-main); border: 1px solid var(--agent-border-main); border-radius: 12px; box-shadow: var(--agent-shadow-float); z-index: 2000; overflow: hidden; color: var(--agent-text-main); font-family: inherit">
                </div>
                <div class="chat-input-container">
                    <textarea id="chat-textarea" aria-label="Message assistant..." placeholder="${this.props.placeholder || 'Ask anything, @ to mention, / for skills'}" style="width: 100%; box-sizing: border-box; padding: var(--agent-input-padding); border: none; background-color: transparent; color: var(--agent-text-main); font-size: var(--agent-font-main); outline: none; resize: none; min-height: 48px; max-height: 200px; line-height: var(--agent-line-height-main); font-family: inherit; overflow-y: auto"></textarea>
                    <div id="input-controls" style="position: absolute; right: 10px; bottom: 10px; display: flex; align-items: center; gap: 8px">
                    </div>
                </div>

                <div style="width: 100%; display: flex; justify-content: flex-start; padding: 0 4px; gap: 12px; alignItems: center">
                    ${this.props.onOpenTerminal ? `
                        <button id="btn-open-terminal" style="background: transparent; border: none; cursor: pointer; font-size: var(--agent-font-small); color: var(--agent-text-muted); display: flex; align-items: center; gap: 4px; padding: 4px 0; opacity: 0.7; transition: opacity 0.2s">
                            ${CubeIcon(14)}
                            <span>Open terminal</span>
                        </button>
                    ` : ''}
                    
                    <div style="position: relative">
                        <button id="btn-model-selector" style="background: transparent; border: none; cursor: pointer; font-size: var(--agent-font-small); color: var(--agent-text-muted); display: flex; align-items: center; gap: 4px; padding: 4px 0; opacity: 0.7; transition: opacity 0.2s">
                            <div style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--agent-accent)"></div>
                            <span id="current-model-name">${currentModel?.name || 'Select Model'}</span>
                        </button>
                        <div id="model-menu" style="display: none; position: absolute; bottom: 100%; left: 0; margin-bottom: 8px; width: 220px; background-color: var(--agent-bg-main); border: 1px solid var(--agent-border-main); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); overflow: hidden; z-index: 1000">
                            <div id="model-options-container" style="max-height: 200px; overflow-y: auto; padding: 4px">
                            </div>
                        </div>
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
        const modelMenu = this.query<HTMLElement>('#model-menu')!;

        textarea.addEventListener('input', () => {
            this.inputValue = textarea.value;
            this.updateDynamicParts();
            this.handleInputSuggestions(textarea);
        });

        textarea.addEventListener('keydown', (e) => {
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
            modelMenu.style.display = this.isModelMenuOpen ? 'block' : 'none';
        });

        document.addEventListener('click', (e) => {
            const isInside = this.element.contains(e.target as Node);
            if (!isInside) {
                this.isModelMenuOpen = false;
                modelMenu.style.display = 'none';
                this.closeSuggestions();
            }
        });
    }

    private updateDynamicParts() {
        const textarea = this.query<HTMLTextAreaElement>('#chat-textarea')!;
        const controls = this.query<HTMLElement>('#input-controls')!;
        const modelName = this.query<HTMLElement>('#current-model-name')!;
        const modelContainer = this.query<HTMLElement>('#model-options-container')!;

        // Update Textarea
        if (textarea.value !== this.inputValue) {
            textarea.value = this.inputValue;
        }
        textarea.disabled = this.props.isProcessing;
        this.autoResize(textarea);

        // Update Controls (Send/Cancel buttons)
        controls.innerHTML = `
            ${this.props.isProcessing ? `
                <button id="btn-cancel" style="background-color: var(--agent-bg-subtle); color: var(--agent-error); border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--agent-shadow-button)" title="Cancel processing">${StopIcon()}</button>
            ` : ''}
            <button id="btn-send" style="background-color: var(--agent-bg-subtle); color: var(--agent-text-muted); border: none; border-radius: 50%; width: 32px; height: 32px; cursor: default; display: flex; align-items: center; justify-content: center; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1)" disabled>${ArrowRightIcon()}</button>
        `;

        const btnSend = this.query<HTMLButtonElement>('#btn-send')!;
        const btnCancel = this.query<HTMLButtonElement>('#btn-cancel');
        
        btnSend.addEventListener('click', () => this.handleSend());
        btnCancel?.addEventListener('click', () => this.props.onCancel());
        this.updateSendButtonState(this.inputValue, btnSend);

        // Update Model Selector
        const currentModel = this.props.models.find(m => m.id === this.props.currentModelId) || this.props.models[0];
        if (modelName) modelName.textContent = currentModel?.name || 'Select Model';

        if (modelContainer) {
            modelContainer.innerHTML = this.props.models.map(m => `
                <div class="model-option" data-id="${m.id}" style="padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: var(--agent-font-main); color: ${m.id === this.props.currentModelId ? 'var(--agent-accent)' : 'var(--agent-text-main)'}; background-color: ${m.id === this.props.currentModelId ? 'var(--agent-bg-subtle)' : 'transparent'}; display: flex; align-items: center; gap: 8px; transition: all 0.15s ease">
                    <div style="width: 6px; height: 6px; border-radius: 50%; background-color: ${m.id === this.props.currentModelId ? 'var(--agent-accent)' : 'transparent'}; border: ${m.id === this.props.currentModelId ? 'none' : '1px solid var(--agent-border-main)'}"></div>
                    <div style="flex-grow: 1">${m.name}</div>
                </div>
            `).join('');

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

    private handleInputSuggestions(textarea: HTMLTextAreaElement) {
        const value = textarea.value;
        const pos = textarea.selectionStart;
        const textBefore = value.substring(0, pos);
        
        const lastAt = textBefore.lastIndexOf('@');
        const lastSlash = textBefore.lastIndexOf('/');
        
        const lastTrigger = Math.max(lastAt, lastSlash);
        
        if (lastTrigger !== -1) {
            const triggerChar = textBefore[lastTrigger] as '@' | '/';
            // Only trigger if it's at start of string or preceded by whitespace
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
            <div id="suggestion-list" style="max-height: 200px; overflow-y: auto" class="agent-scrollbar">
                ${items.map((item, i) => `
                    <div class="suggestion-item" data-index="${i}" style="padding: 8px 12px; cursor: pointer; display: flex; flex-direction: row; align-items: center; gap: 8px; background: ${i === this.selectedSuggestionIndex ? 'var(--agent-bg-subtle)' : 'transparent'}; border-left: 2px solid ${i === this.selectedSuggestionIndex ? 'var(--agent-accent)' : 'transparent'}">
                        <div style="font-weight: 500; font-size: var(--agent-font-main); color: ${i === this.selectedSuggestionIndex ? 'var(--agent-text-main)' : 'var(--agent-text-subtle)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1">${item.label}</div>
                        ${item.detail ? `<div style="font-size: var(--agent-font-small); color: var(--agent-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50%">${item.detail}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        const activeItem = popup.querySelector(`[data-index="${this.selectedSuggestionIndex}"]`) as HTMLElement;
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest' });
        }

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
