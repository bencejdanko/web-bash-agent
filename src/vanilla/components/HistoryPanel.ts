import { BaseComponent } from '../BaseComponent';
import { Conversation } from '../../types';
import { TrashIcon } from './Icons';

interface HistoryPanelProps {
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClose: () => void;
  currentConversationId: string | null;
}

const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return 'Just now';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(diff / 86400000);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
};

export class HistoryPanel extends BaseComponent<HistoryPanelProps> {
    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        Object.assign(div.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: 'var(--agent-overlay-bg)',
            zIndex: '100',
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.2s ease-out',
            overflow: 'hidden'
        });
        return div;
    }

    init() {
        this.element.innerHTML = `
            <div class="history-overlay-content" style="display: flex; flex-direction: column; background-color: transparent; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); height: 100%">
                <header style="padding: 16px 20px; border-bottom: 1px solid var(--agent-bg-subtle); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--agent-header-glass)">
                    <span style="font-weight: 600; font-size: 15px; color: var(--agent-text-main)">Past conversations</span>
                    <button id="history-close" style="background: none; border: none; cursor: pointer; font-size: 22px; color: var(--agent-text-muted); display: flex; align-items: center; justify-content: center; padding: 4px; line-height: 1">&times;</button>
                </header>
                <div class="history-list agent-scrollbar" style="flex: 1; overflow-y: auto; padding: 16px 12px"></div>
            </div>
        `;

        this.query('#history-close')?.addEventListener('click', this.props.onClose);
        this.render();
    }

    render() {
        const list = this.query<HTMLElement>('.history-list')!;
        if (!list) return;

        list.innerHTML = '';
        
        if (this.props.conversations.length === 0) {
            list.innerHTML = `<div style="padding: 48px 20px; text-align: center; color: var(--agent-text-muted); font-size: 14px">No conversations yet</div>`;
        } else {
            [...this.props.conversations]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .forEach(conv => {
                    const item = document.createElement('div');
                    item.className = `history-item ${conv.id === this.props.currentConversationId ? 'active' : ''}`;
                    Object.assign(item.style, {
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: conv.id === this.props.currentConversationId ? 'var(--agent-bg-subtle)' : 'transparent',
                        transition: 'background-color 0.2s'
                    });

                    item.onmouseover = () => { if (conv.id !== this.props.currentConversationId) item.style.backgroundColor = 'rgba(0,0,0,0.02)'; };
                    item.onmouseout = () => { if (conv.id !== this.props.currentConversationId) item.style.backgroundColor = 'transparent'; };

                    item.innerHTML = `
                        <div style="display: flex; flex-direction: column; gap: 4px; overflow: hidden; flex: 1">
                            <span style="font-weight: 500; font-size: 13px; color: var(--agent-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${conv.title || 'Untitled Chat'}</span>
                            <span style="font-size: 11px; color: var(--agent-text-muted)">${formatRelativeTime(conv.updatedAt)}</span>
                        </div>
                        <button class="delete-history" data-id="${conv.id}" style="background: none; border: none; cursor: pointer; color: var(--agent-text-muted); opacity: 0.5; padding: 6px; border-radius: 4px; transition: all 0.2s">${TrashIcon()}</button>
                    `;

                    item.addEventListener('click', () => this.props.onSelectConversation(conv.id));
                    
                    const deleteBtn = item.querySelector('.delete-history') as HTMLElement;
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.props.onDeleteConversation(conv.id);
                    });
                    deleteBtn.onmouseover = () => { deleteBtn.style.opacity = '1'; deleteBtn.style.color = 'var(--agent-error)'; deleteBtn.style.backgroundColor = 'var(--agent-error-bg)'; };
                    deleteBtn.onmouseout = () => { deleteBtn.style.opacity = '0.5'; deleteBtn.style.color = 'var(--agent-text-muted)'; deleteBtn.style.backgroundColor = 'transparent'; };

                    list.appendChild(item);
                });
        }
    }
}
