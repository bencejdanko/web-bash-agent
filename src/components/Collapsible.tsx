import React, { useState, useRef, useLayoutEffect } from 'react';

interface CollapsibleProps {
  isOpen: boolean;
  onToggle: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  showBorder?: boolean;
}

/**
 * Generic Collapsible component for work sessions and reasoning thoughts
 */
export const Collapsible: React.FC<CollapsibleProps> = ({ 
  isOpen, 
  onToggle, 
  title, 
  children, 
  showBorder = true 
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | string>(isOpen ? 'auto' : 0);

  useLayoutEffect(() => {
    if (isOpen && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [isOpen, children]);

  return (
    <div style={{ marginBottom: '4px' }}>
      <button 
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          userSelect: 'none',
          padding: '4px 0',
          backgroundColor: 'transparent',
          border: 'none',
          fontSize: '13px',
          color: '#94a3b8',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
          textAlign: 'left',
          width: 'fit-content'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.color = '#64748b';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.color = '#94a3b8';
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '14px',
          height: '14px',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          opacity: 0.7,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <span style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
          {title}
        </span>
      </button>
      
      <div 
        style={{ 
          height: typeof height === 'number' ? `${height}px` : height,
          overflow: 'hidden',
          transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div ref={contentRef} style={{ 
          padding: '4px 0 8px 0',
          borderLeft: 'none',
          marginLeft: '0',
          marginTop: '2px'
        }}>
          {children}
        </div>
      </div>
    </div>
  );
};
