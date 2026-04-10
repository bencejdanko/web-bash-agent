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
}

export class ChatInput extends BaseComponent<ChatInputProps> {
    private inputValue: string = '';
    private isModelMenuOpen: boolean = false;

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
        const currentModel = this.props.models.find(m => m.id === this.props.currentModelId) || this.props.models[0];

        this.element.innerHTML = `
            <div class="chat-input-inner-wrapper" style="display: flex; flex-direction: column; gap: 8px; width: 100%">
                <div class="chat-input-container" style="position: relative; width: 100%; display: flex; flex-direction: column; border: 1px solid var(--agent-border-main); border-radius: 16px; backgroundColor: var(--agent-bg-main); transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: var(--agent-card-shadow); overflow: hidden; padding-bottom: 32px">
                    <textarea id="chat-textarea" aria-label="Message assistant..." placeholder="${this.props.placeholder || 'Ask anything...'}" style="width: 100%; box-sizing: border-box; padding: var(--agent-input-padding); padding-bottom: 8px; border: none; background-color: transparent; color: var(--agent-text-main); font-size: 14px; outline: none; resize: none; min-height: 48px; max-height: 200px; line-height: 1.5; font-family: inherit; overflow-y: auto" ${this.props.isProcessing ? 'disabled' : ''}></textarea>
                    <div style="position: absolute; right: 10px; bottom: 10px; display: flex; align-items: center; gap: 8px">
                        ${this.props.isProcessing ? `
                            <button id="btn-cancel" style="background-color: var(--agent-bg-subtle); color: var(--agent-error); border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--agent-shadow-button)" title="Cancel processing">${StopIcon()}</button>
                        ` : ''}
                        <button id="btn-send" style="background-color: var(--agent-bg-subtle); color: var(--agent-text-muted); border: none; border-radius: 50%; width: 32px; height: 32px; cursor: default; display: flex; align-items: center; justify-content: center; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1)" disabled>${ArrowRightIcon()}</button>
                    </div>
                </div>

                <div style="width: 100%; display: flex; justify-content: flex-start; padding: 0 4px; gap: 12px; alignItems: center">
                    ${this.props.onOpenTerminal ? `
                        <button id="btn-open-terminal" style="background: transparent; border: none; cursor: pointer; font-size: 11px; color: var(--agent-text-muted); display: flex; align-items: center; gap: 4px; padding: 4px 0; opacity: 0.7; transition: opacity 0.2s">
                            ${CubeIcon(14)}
                            <span>Open terminal</span>
                        </button>
                    ` : ''}
                    
                    <div style="position: relative">
                        <button id="btn-model-selector" style="background: transparent; border: none; cursor: pointer; font-size: 11px; color: var(--agent-text-muted); display: flex; align-items: center; gap: 4px; padding: 4px 0; opacity: 0.7; transition: opacity 0.2s">
                            <div style="width: 6px; height: 6px; border-radius: 50%; background-color: var(--agent-accent)"></div>
                            <span>${currentModel?.name || 'Select Model'}</span>
                        </button>
                        <div id="model-menu" style="display: none; position: absolute; bottom: 100%; left: 0; margin-bottom: 8px; width: 220px; background-color: var(--agent-bg-main); border: 1px solid var(--agent-border-main); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); overflow: hidden; z-index: 1000">
                            <div style="max-height: 200px; overflow-y: auto; padding: 4px">
                                ${this.props.models.map(m => `
                                    <div class="model-option" data-id="${m.id}" style="padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; color: ${m.id === this.props.currentModelId ? 'var(--agent-accent)' : 'var(--agent-text-main)'}; background-color: ${m.id === this.props.currentModelId ? 'var(--agent-bg-subtle)' : 'transparent'}; display: flex; align-items: center; gap: 8px; transition: all 0.15s ease">
                                        <div style="width: 6px; height: 6px; border-radius: 50%; background-color: ${m.id === this.props.currentModelId ? 'var(--agent-accent)' : 'transparent'}; border: ${m.id === this.props.currentModelId ? 'none' : '1px solid var(--agent-border-main)'}"></div>
                                        <div style="flex-grow: 1">${m.name}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const textarea = this.query<HTMLTextAreaElement>('#chat-textarea')!;
        const btnSend = this.query<HTMLButtonElement>('#btn-send')!;
        const btnCancel = this.query<HTMLButtonElement>('#btn-cancel');
        const btnOpenTerminal = this.query<HTMLButtonElement>('#btn-open-terminal');
        const btnModelSelector = this.query<HTMLButtonElement>('#btn-model-selector');
        const modelMenu = this.query<HTMLElement>('#model-menu')!;

        textarea.value = this.inputValue;
        this.updateSendButtonState(this.inputValue, btnSend);

        textarea.addEventListener('input', () => {
            this.inputValue = textarea.value;
            this.updateSendButtonState(this.inputValue, btnSend);
            this.autoResize(textarea);
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        btnSend.addEventListener('click', () => this.handleSend());
        btnCancel?.addEventListener('click', () => this.props.onCancel());
        btnOpenTerminal?.addEventListener('click', () => this.props.onOpenTerminal?.());
        
        btnModelSelector?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isModelMenuOpen = !this.isModelMenuOpen;
            modelMenu.style.display = this.isModelMenuOpen ? 'block' : 'none';
        });

        document.addEventListener('click', () => {
            this.isModelMenuOpen = false;
            modelMenu.style.display = 'none';
        });

        this.element.querySelectorAll('.model-option').forEach(opt => {
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
