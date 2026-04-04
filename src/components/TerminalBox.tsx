import React from 'react';

interface TerminalBoxProps {
  command: string;
  output?: string;
}

export const TerminalBox: React.FC<TerminalBoxProps> = ({ command, output }) => {
  return (
    <div className="terminal-box" style={{ margin: '0 0 16px 0' }}>
      <div className="terminal-header" style={{ padding: '6px 10px' }}>
        <span style={{ fontWeight: 500, fontSize: '11px' }}>Bash Command</span>
      </div>
      <div className="terminal-content" style={{ padding: '10px' }}>
        <div className="terminal-command-line" style={{ fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flex: 1, opacity: 0.9 }}>
            <span className="breadcrumb" style={{ fontSize: '10px' }}>$</span>
            <span style={{ fontWeight: 500, color: '#f4f4f5' }}>{command}</span>
          </div>
        </div>
        {output ? (
          <div style={{ color: '#d1d5db', whiteSpace: 'pre-wrap', marginTop: '8px', fontSize: '11px', lineHeight: 1.4, opacity: 0.9 }}>
            {output}
          </div>
        ) : null}
      </div>
    </div>
  );
};
