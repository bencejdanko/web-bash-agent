import React from 'react';
import { Conversation } from '../types';
import { TrashIcon } from './Icons';

interface HistoryItemProps {
  conv: Conversation;
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  formatRelativeTime: (timestamp: number) => string;
}

export const HistoryItem: React.FC<HistoryItemProps> = ({
  conv,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  formatRelativeTime
}) => {
  return (
    <div 
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
  );
};
