import { BaseComponent } from '../BaseComponent';
import { PlusIcon, HistoryIcon, HammerIcon, MCPIcon, EllipsisIcon, XIcon } from './Icons';

interface SidebarHeaderProps {
  onToggleHistory: () => void;
  onToggleTools: () => void;
  onToggleRegistry: () => void;
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
                <button id="btn-history" title="Past conversations [CTRL+ALT+H]" class="header-btn" style="gap: 6px; padding: 4px 8px">
                    <span class="top-accent-text" style="font-size: 10px; color: var(--agent-text-muted)">History <code class="terminal-shortcut-hint" style="font-size: 8px">[C+A+H]</code></span>
                    ${HistoryIcon(14)}
                </button>
                <button id="btn-tools" title="Agent Tools & Skills [CTRL+ALT+T]" class="header-btn" style="gap: 6px; padding: 4px 8px">
                    <span class="top-accent-text" style="font-size: 10px; color: var(--agent-text-muted)">Tools <code class="terminal-shortcut-hint" style="font-size: 8px">[C+A+T]</code></span>
                    ${HammerIcon(14)}
                </button>
                <button id="btn-mcp" title="MCP [CTRL+ALT+M]" class="header-btn" style="gap: 6px; padding: 4px 8px">
                    <span class="top-accent-text" style="font-size: 10px; color: var(--agent-text-muted)">MCP <code class="terminal-shortcut-hint" style="font-size: 8px">[C+A+M]</code></span>
                    ${MCPIcon(14)}
                </button>
                <div class="header-divider" style="height: 16px; width: 1px; background: var(--agent-border-main); margin: 0 4px"></div>
                <button id="btn-close-agent" title="Close Agent [CTRL+K]" class="header-btn">${XIcon(16)}</button>
            </div>
        `;

        this.query('#btn-history')?.addEventListener('click', this.props.onToggleHistory);
        this.query('#btn-tools')?.addEventListener('click', this.props.onToggleTools);
        this.query('#btn-mcp')?.addEventListener('click', this.props.onToggleRegistry);
        this.query('#btn-close-agent')?.addEventListener('click', this.props.onClose);
    }
}
