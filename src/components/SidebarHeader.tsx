import React from 'react';
import { ChevronRight, PlusIcon, HistoryIcon } from './Icons';

interface SidebarHeaderProps {
  onCollapse: () => void;
  onNewChat: () => void;
  onToggleHistory: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ 
  onCollapse, 
  onNewChat, 
  onToggleHistory 
}) => {
  return (
    <header 
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: 300, fontSize: '15px', color: '#111827', letterSpacing: '-0.02em' }}>Agent</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button 
              onClick={onNewChat}
              style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#9ca3af';
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
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#9ca3af';
              }}
              title="Past conversations"
          >
              <HistoryIcon />
          </button>
          <button 
              onClick={onCollapse}
              style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#9ca3af';
              }}
              aria-label="Collapse sidebar"
          >
              <ChevronRight />
          </button>
      </div>
    </header>
  );
};
