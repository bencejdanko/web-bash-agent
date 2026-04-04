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
        backgroundColor: 'var(--agent-bg-main)',
        border: '1px solid var(--agent-border-main)',
        boxShadow: 'var(--agent-toggle-shadow)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 9999,
        color: 'var(--agent-text-subtle)',
        transition: 'all 0.2s',
      }}
      aria-label="Agent"
    >
      <BotIcon />
    </button>
  );
};
