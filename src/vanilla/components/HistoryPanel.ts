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
    private selectedIndex: number = 0;
    private sortedConversations: Conversation[] = [];

    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        div.tabIndex = 0; // Make focusable
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
            overflow: 'hidden',
            outline: 'none'
        });
        return div;
    }

    init() {
        this.element.innerHTML = `
            <div class="history-overlay-content" style="display: flex; flex-direction: column; background-color: transparent; height: 100%">
                <header style="padding: 16px 20px; border-bottom: 1px solid var(--agent-border-main); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: var(--agent-header-glass)">
                    <span style="font-weight: 600; font-size: 15px; color: var(--agent-text-main)">Past conversations</span>
                    <button id="history-close" style="background: none; border: none; cursor: pointer; font-size: 22px; color: var(--agent-text-muted); display: flex; align-items: center; justify-content: center; padding: 4px; line-height: 1">&times;</button>
                </header>
                <div class="history-list agent-scrollbar" style="flex: 1; overflow-y: auto; padding: 16px 12px"></div>
                <footer style="padding: 12px 20px; border-top: 1px solid var(--agent-border-main); background: var(--agent-header-glass); display: flex; justify-content: center; gap: 16px">
                    <span style="font-size: 11px; color: var(--agent-text-muted); display: flex; align-items: center; gap: 4px">
                        <code class="terminal-shortcut-hint" style="font-size: 10px; opacity: 1">↑↓</code> Navigate
                    </span>
                    <span style="font-size: 11px; color: var(--agent-text-muted); display: flex; align-items: center; gap: 4px">
                        <code class="terminal-shortcut-hint" style="font-size: 10px; opacity: 1">ENTER</code> Select
                    </span>
                    <span style="font-size: 11px; color: var(--agent-text-muted); display: flex; align-items: center; gap: 4px">
                        <code class="terminal-shortcut-hint" style="font-size: 10px; opacity: 1">ESC</code> Close
                    </span>
                </footer>
            </div>
        `;

        this.query('#history-close')?.addEventListener('click', this.props.onClose);
        
        this.element.addEventListener('keydown', (e) => {
            if (this.sortedConversations.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % this.sortedConversations.length;
                this.render();
                this.scrollToSelected();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + this.sortedConversations.length) % this.sortedConversations.length;
                this.render();
                this.scrollToSelected();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const conv = this.sortedConversations[this.selectedIndex];
                if (conv) this.props.onSelectConversation(conv.id);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.props.onClose();
            }
        });

        // Autofocus the panel when it's created
        requestAnimationFrame(() => {
            this.element.focus();
        });

        this.render();
    }

    private scrollToSelected() {
        const list = this.query('.history-list')!;
        const selected = list.querySelector('.history-item.selected') as HTMLElement;
        if (selected) {
            selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    render() {
        const list = this.query<HTMLElement>('.history-list')!;
        if (!list) return;

        this.sortedConversations = [...this.props.conversations]
            .sort((a, b) => b.updatedAt - a.updatedAt);

        if (this.selectedIndex >= this.sortedConversations.length) {
            this.selectedIndex = Math.max(0, this.sortedConversations.length - 1);
        }

        list.innerHTML = '';
        
        if (this.sortedConversations.length === 0) {
            list.innerHTML = `<div style="padding: 48px 20px; text-align: center; color: var(--agent-text-muted); font-size: 14px">No conversations yet</div>`;
        } else {
            this.sortedConversations.forEach((conv, index) => {
                const isSelected = index === this.selectedIndex;
                const isActive = conv.id === this.props.currentConversationId;
                
                const item = document.createElement('div');
                item.className = `history-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`;
                Object.assign(item.style, {
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: isSelected ? 'rgba(0,0,0,0.05)' : (isActive ? 'var(--agent-bg-subtle)' : 'transparent'),
                    border: isSelected ? '1px solid var(--agent-border-main)' : '1px solid transparent',
                    transition: 'all 0.2s'
                });

                item.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 4px; overflow: hidden; flex: 1">
                        <span style="font-weight: 500; font-size: 13px; color: var(--agent-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${conv.title || 'Untitled Chat'}</span>
                        <span style="font-size: 11px; color: var(--agent-text-muted)">${formatRelativeTime(conv.updatedAt)}</span>
                    </div>
                    <button class="delete-history" data-id="${conv.id}" style="background: none; border: none; cursor: pointer; color: var(--agent-text-muted); opacity: 0.5; padding: 6px; border-radius: 4px; transition: all 0.2s">${TrashIcon()}</button>
                `;

                item.addEventListener('click', () => {
                    this.selectedIndex = index;
                    this.props.onSelectConversation(conv.id);
                });
                
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
