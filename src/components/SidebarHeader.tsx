import { ChevronRight, PlusIcon, HistoryIcon, HammerIcon, MCPIcon, EllipsisIcon } from './Icons';

interface SidebarHeaderProps {
  onCollapse: () => void;
  onNewChat: () => void;
  onToggleHistory: () => void;
  onToggleTools: () => void;
  onToggleRegistry: () => void;
  onToggleSystem: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ 
  onCollapse, 
  onNewChat, 
  onToggleHistory,
  onToggleTools,
  onToggleRegistry,
  onToggleSystem
}) => {
  return (
    <header 
      style={{
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--agent-bg-main)',
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: 300, fontSize: '15px', color: 'var(--agent-text-main)', letterSpacing: '-0.02em' }}>Agent</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button 
              onClick={onNewChat}
              style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: 'var(--agent-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--agent-bg-subtle)';
                e.currentTarget.style.color = 'var(--agent-text-subtle)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--agent-text-muted)';
              }}
              title="New Chat"
          >
              <PlusIcon />
          </button>
          <button 
              onClick={onToggleHistory}
              style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: 'var(--agent-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--agent-bg-subtle)';
                e.currentTarget.style.color = 'var(--agent-text-subtle)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--agent-text-muted)';
              }}
              title="Past conversations"
          >
              <HistoryIcon />
          </button>
          <button 
              onClick={onToggleTools}
              style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: 'var(--agent-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--agent-bg-subtle)';
                e.currentTarget.style.color = 'var(--agent-text-subtle)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--agent-text-muted)';
              }}
              title="Agent Tools & Skills"
          >
              <HammerIcon size={18} />
          </button>
          <button 
              onClick={onToggleRegistry}
              style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: 'var(--agent-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--agent-bg-subtle)';
                e.currentTarget.style.color = 'var(--agent-text-subtle)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--agent-text-muted)';
              }}
              title="MCP"
          >
              <MCPIcon size={18} />
          </button>
          <button 
              onClick={onToggleSystem}
              style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: 'var(--agent-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--agent-bg-subtle)';
                e.currentTarget.style.color = 'var(--agent-text-subtle)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--agent-text-muted)';
              }}
              title="System Information"
          >
              <EllipsisIcon size={18} />
          </button>
          <button 
              onClick={onCollapse}
              style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: 'var(--agent-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--agent-bg-subtle)';
                e.currentTarget.style.color = 'var(--agent-text-subtle)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--agent-text-muted)';
              }}
              aria-label="Collapse sidebar"
          >
              <ChevronRight />
          </button>
      </div>
    </header>
  );
};
