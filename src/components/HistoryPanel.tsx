import React, { useEffect, useState } from 'react';
import { Conversation } from '../types';
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
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backdropFilter: 'blur(3px)',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        className="history-overlay-content"
        style={{
          width: '100%',
          maxWidth: '768px',
          maxHeight: '600px',
          backgroundColor: '#fff',
          borderRadius: '16px',
          boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e5e7eb',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <header 
          style={{
            padding: '16px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
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
            padding: '8px 0'
          }}
        >
          {conversations.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
              No conversations yet
            </div>
          ) : (
            conversations
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map(conv => (
                <div 
                  key={conv.id}
                  style={{
                    padding: '12px 16px',
                    margin: '0 8px 4px 8px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    backgroundColor: conv.id === currentConversationId ? '#f3f4f6' : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    if (conv.id !== currentConversationId) e.currentTarget.style.backgroundColor = '#f9fafb';
                  }}
                  onMouseOut={(e) => {
                    if (conv.id !== currentConversationId) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <div style={{ flex: 1, overflow: 'hidden', marginRight: '8px' }}>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: conv.id === currentConversationId ? 600 : 400,
                      color: '#111827',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {conv.title || 'Untitled Chat'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      {formatRelativeTime(conv.updatedAt)}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px',
                      color: '#d1d5db',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '6px',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#fee2e2';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#d1d5db';
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
