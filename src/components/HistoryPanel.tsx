import React, { useEffect } from 'react';
import { Conversation } from '../types';
import { HistoryItem } from './HistoryItem';

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
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  
  return new Date(timestamp).toLocaleDateString();
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  conversations,
  onSelectConversation,
  onDeleteConversation,
  onClose,
  currentConversationId
}) => {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.history-overlay-content')) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.2s ease-out',
        borderTopLeftRadius: 'inherit',
        borderTopRightRadius: 'inherit',
        borderBottomLeftRadius: 'inherit',
        borderBottomRightRadius: 'inherit',
        overflow: 'hidden'
      }}
    >
      <div 
        className="history-overlay-content"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'transparent',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <header 
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            background: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '15px', color: '#111827' }}>Past conversations</span>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '22px',
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              lineHeight: 1
            }}
          >
            &times;
          </button>
        </header>

        <div 
          className="history-list agent-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 12px'
          }}
        >
          {conversations.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
              No conversations yet
            </div>
          ) : (
            conversations
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map(conv => (
                <HistoryItem 
                  key={conv.id}
                  conv={conv}
                  currentConversationId={currentConversationId}
                  onSelectConversation={(id) => {
                    onSelectConversation(id);
                  }}
                  onDeleteConversation={onDeleteConversation}
                  formatRelativeTime={formatRelativeTime}
                />
              ))
          )}
        </div>
      </div>
    </div>
  );
};
