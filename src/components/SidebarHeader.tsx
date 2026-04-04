import React from 'react';
import { ChevronRight } from './Icons';

interface SidebarHeaderProps {
  isProcessing: boolean;
  onCollapse: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ isProcessing, onCollapse }) => {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: isProcessing ? '#fbbf24' : '#10b981', 
            boxShadow: isProcessing ? '0 0 8px #fbbf24' : 'none' 
          }}></div>
          <span style={{ fontWeight: 600, fontSize: '15px', color: '#111827', letterSpacing: '-0.02em' }}>PageFind Agent</span>
      </div>
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
    </header>
  );
};
