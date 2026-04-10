import { BaseComponent } from '../BaseComponent';
import { ChevronRight, PlusIcon, HistoryIcon, HammerIcon, MCPIcon, EllipsisIcon } from './Icons';

interface SidebarHeaderProps {
  onNewChat: () => void;
  onToggleHistory: () => void;
  onToggleTools: () => void;
  onToggleRegistry: () => void;
  onToggleSystem: () => void;
}

export class SidebarHeader extends BaseComponent<SidebarHeaderProps> {
    protected createRootElement(): HTMLElement {
        const header = document.createElement('header');
        header.style.padding = 'var(--agent-input-padding)';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.backgroundColor = 'var(--agent-bg-main)';
        header.style.flexShrink = '0';
        return header;
    }

    render() {
        this.element.innerHTML = `
            <span style="font-weight: 300; font-size: var(--agent-font-header); color: var(--agent-text-main); letter-spacing: -0.02em">Agent</span>
            <div style="display: flex; align-items: center; gap: 4px">
                <button id="btn-new-chat" title="New Chat" class="header-btn">${PlusIcon()}</button>
                <button id="btn-history" title="Past conversations" class="header-btn">${HistoryIcon()}</button>
                <button id="btn-tools" title="Agent Tools & Skills" class="header-btn">${HammerIcon(18)}</button>
                <button id="btn-mcp" title="MCP" class="header-btn">${MCPIcon(18)}</button>
                <button id="btn-system" title="System Information" class="header-btn">${EllipsisIcon(18)}</button>
            </div>
        `;

        this.element.querySelectorAll('.header-btn').forEach(btn => {
            const h = btn as HTMLElement;
            h.style.background = 'none';
            h.style.border = 'none';
            h.style.cursor = 'pointer';
            h.style.padding = '6px';
            h.style.color = 'var(--agent-text-muted)';
            h.style.display = 'flex';
            h.style.alignItems = 'center';
            h.style.justifyContent = 'center';
            h.style.borderRadius = '6px';
            h.style.transition = 'all 0.2s';

            h.onmouseover = () => {
                h.style.backgroundColor = 'var(--agent-bg-subtle)';
                h.style.color = 'var(--agent-text-subtle)';
            };
            h.onmouseout = () => {
                h.style.backgroundColor = 'transparent';
                h.style.color = 'var(--agent-text-muted)';
            };
        });

        this.query('#btn-new-chat')?.addEventListener('click', this.props.onNewChat);
        this.query('#btn-history')?.addEventListener('click', this.props.onToggleHistory);
        this.query('#btn-tools')?.addEventListener('click', this.props.onToggleTools);
        this.query('#btn-mcp')?.addEventListener('click', this.props.onToggleRegistry);
        this.query('#btn-system')?.addEventListener('click', this.props.onToggleSystem);
    }
}
