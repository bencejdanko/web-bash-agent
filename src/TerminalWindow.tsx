import React from 'react';

export interface TerminalWindowProps {
  command: string;
  output: string;
  isVisible?: boolean;
}

export const TerminalWindow: React.FC<TerminalWindowProps> = ({ command, output, isVisible = true }) => {
  if (!isVisible) return null;

  return (
    <div 
      className="agent-terminal-window"
      style={{
        position: 'fixed',
        right: '24px',
        top: '24px',
        bottom: '24px',
        width: '450px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        color: '#1f2937',
        fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e5e7eb',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      <div 
        className="terminal-header"
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11px',
          color: '#6b7280',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 600,
          backgroundColor: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', opacity: 0.8 }}></span>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b', opacity: 0.8 }}></span>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', opacity: 0.8 }}></span>
        </div>
        <span style={{ marginLeft: '12px' }}>Bash execution context</span>
      </div>
      <div 
        className="terminal-body agent-scrollbar"
        style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          fontSize: '13px',
          lineHeight: '1.7',
          backgroundColor: '#fafafa',
        }}
      >
        {command && (
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>$</span>
            <span style={{ color: '#111827', fontWeight: 500 }}>{command}</span>
          </div>
        )}
        <pre style={{ 
            margin: 0, 
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-all',
            color: '#374151',
            fontSize: '12px',
        }}>
          {output}
        </pre>
      </div>
    </div>
  );
};

