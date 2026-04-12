import { BaseComponent } from '../BaseComponent';
import { PlusIcon, HistoryIcon, HammerIcon, MCPIcon, EllipsisIcon, XIcon } from './Icons';

interface SidebarHeaderProps {
  onNewChat: () => void;
  onToggleHistory: () => void;
  onToggleTools: () => void;
  onToggleRegistry: () => void;
  onToggleSystem: () => void;
  onClose: () => void;
}

export class SidebarHeader extends BaseComponent<SidebarHeaderProps> {
    protected createRootElement(): HTMLElement {
        const header = document.createElement('header');
        header.className = 'agent-sidebar-header';
        return header;
    }

    render() {
        this.element.innerHTML = `
            <span class="agent-sidebar-title">Agent</span>
            <div style="display: flex; align-items: center; gap: 4px">
                <button id="btn-new-chat" title="New Chat" class="header-btn">${PlusIcon()}</button>
                <button id="btn-history" title="Past conversations" class="header-btn">${HistoryIcon()}</button>
                <button id="btn-tools" title="Agent Tools & Skills" class="header-btn">${HammerIcon(18)}</button>
                <button id="btn-mcp" title="MCP" class="header-btn">${MCPIcon(18)}</button>
                <button id="btn-system" title="System Information" class="header-btn">${EllipsisIcon(18)}</button>
                <div class="header-divider" style="height: 16px; width: 1px; background: var(--agent-border-main); margin: 0 4px"></div>
                <button id="btn-close-agent" title="Close Agent [CTRL+K]" class="header-btn">${XIcon(18)}</button>
            </div>
        `;

        this.query('#btn-new-chat')?.addEventListener('click', this.props.onNewChat);
        this.query('#btn-history')?.addEventListener('click', this.props.onToggleHistory);
        this.query('#btn-tools')?.addEventListener('click', this.props.onToggleTools);
        this.query('#btn-mcp')?.addEventListener('click', this.props.onToggleRegistry);
        this.query('#btn-system')?.addEventListener('click', this.props.onToggleSystem);
        this.query('#btn-close-agent')?.addEventListener('click', this.props.onClose);
    }
}
