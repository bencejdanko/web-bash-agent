import React, { useEffect } from 'react';
import { XIcon } from './Icons';

interface InfoPanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({
  title,
  onClose,
  children
}) => {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.info-overlay-content')) {
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
        backgroundColor: 'var(--agent-overlay-bg)',
        zIndex: 110,
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
        className="info-overlay-content"
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
            borderBottom: '1px solid var(--agent-bg-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            background: 'var(--agent-header-glass)',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--agent-text-main)' }}>{title}</span>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--agent-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--agent-text-main)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--agent-text-muted)'}
          >
            <XIcon size={20} />
          </button>
        </header>

        <div 
          className="info-list agent-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
