import React from 'react';
import { useTextHeight } from '../hooks/useTextHeight';
import { StopIcon, ArrowRightIcon } from './Icons';

interface ChatInputProps {
  inputValue: string;
  setInputValue: (val: string) => void;
  isProcessing: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  sidebarWidth: number;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  setInputValue,
  isProcessing,
  onSend,
  onCancel,
  inputRef,
  sidebarWidth,
  placeholder = "Ask a question..."
}) => {
  return (
    <div style={{ width: '100%', flexShrink: 0 }}>
      <div 
        className="chat-input-container"
        style={{ 
          position: 'relative', 
          display: 'flex', 
          flexDirection: 'column',
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          backgroundColor: '#fff',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
        }}
      >
        <textarea 
          ref={inputRef}
          aria-label="Message assistant..."
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend(inputValue);
            }
          }}
          onFocus={(e) => {
            (e.currentTarget.parentNode as HTMLDivElement).style.borderColor = '#111827';
            (e.currentTarget.parentNode as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
          }}
          onBlur={(e) => {
            (e.currentTarget.parentNode as HTMLDivElement).style.borderColor = '#e5e7eb';
            (e.currentTarget.parentNode as HTMLDivElement).style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.02)';
          }}
          style={{
            width: '100%',
            padding: '12px 14px 44px 14px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#111827',
            fontSize: '14px',
            outline: 'none',
            resize: 'none',
            minHeight: '48px',
            height: `${useTextHeight(inputValue || ' ', '14px Inter', sidebarWidth, 21, 20)}px`,
            maxHeight: '200px',
            lineHeight: '1.5',
            fontFamily: 'inherit',
            overflowY: 'auto',
          }}
          disabled={isProcessing}
        />
        <div style={{
          position: 'absolute',
          right: '10px',
          bottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {isProcessing && (
            <button 
              onClick={onCancel}
              style={{
                  backgroundColor: '#f3f4f6',
                  color: '#ef4444',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  flexShrink: 0,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              title="Cancel processing"
            >
              <StopIcon />
            </button>
          )}
          <button 
            onClick={() => {
               onSend(inputValue);
               if (inputRef.current) inputRef.current.style.height = 'auto';
            }}
            disabled={isProcessing || !inputValue.trim()}
            style={{
                backgroundColor: inputValue.trim() ? '#111827' : '#f3f4f6',
                color: inputValue.trim() ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: (inputValue.trim() && !isProcessing) ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                flexShrink: 0,
                transform: (inputValue.trim() && !isProcessing) ? 'scale(1)' : 'scale(0.9)',
                opacity: isProcessing ? 0.5 : 1
            }}
          >
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
};
