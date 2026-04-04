import React from 'react';

export const ThinkingIndicator: React.FC = () => {
  return (
    <div style={{ 
      display: 'flex', 
      gap: '8px', 
      alignItems: 'center', 
      color: '#71717a', 
      padding: '0 4px', 
      animation: 'agentFadeIn 0.5s' 
    }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        <div style={{ 
          width: '5px', 
          height: '5px', 
          borderRadius: '50%', 
          backgroundColor: '#1f1f1f', 
          animation: 'agentPulse 0.8s infinite' 
        }}></div>
        <div style={{ 
          width: '5px', 
          height: '5px', 
          borderRadius: '50%', 
          backgroundColor: '#1f1f1f', 
          animation: 'agentPulse 0.8s infinite 0.2s' 
        }}></div>
        <div style={{ 
          width: '5px', 
          height: '5px', 
          borderRadius: '50%', 
          backgroundColor: '#1f1f1f', 
          animation: 'agentPulse 0.8s infinite 0.4s' 
        }}></div>
      </div>
      <span style={{ fontSize: '13px', fontWeight: 500 }}>Thinking...</span>
    </div>
  );
};
