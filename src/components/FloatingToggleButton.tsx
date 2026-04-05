import React from 'react';
import { BotIcon } from './Icons';

interface FloatingToggleButtonProps {
  onClick: () => void;
}

export const FloatingToggleButton: React.FC<FloatingToggleButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="floating-control-button"
      aria-label="Agent"
    >
      <BotIcon />
    </button>
  );
};
