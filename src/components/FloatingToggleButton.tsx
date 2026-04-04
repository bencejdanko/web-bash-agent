import React from 'react';
import { BotIcon } from './Icons';

interface FloatingToggleButtonProps {
  onClick: () => void;
}

export const FloatingToggleButton: React.FC<FloatingToggleButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        width: '48px',
        height: '48px',
        borderRadius: '24px',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 9999,
        color: '#374151',
        transition: 'all 0.2s',
      }}
      aria-label="PageFind Agent"
    >
      <BotIcon />
    </button>
  );
};
