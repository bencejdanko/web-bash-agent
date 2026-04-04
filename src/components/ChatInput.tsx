import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTextHeight } from '../hooks/useTextHeight';
import { StopIcon, ArrowRightIcon, FileIcon, FolderIcon } from './Icons';

interface ChatInputProps {
  inputValue: string;
  setInputValue: (val: string) => void;
  isProcessing: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  sidebarWidth: number;
  placeholder?: string;
  filesystem?: Record<string, string>;
}

type MentionType = 'none' | 'category' | 'file' | 'dir';

export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  setInputValue,
  isProcessing,
  onSend,
  onCancel,
  inputRef,
  sidebarWidth,
  placeholder = "Ask a question...",
  filesystem = {}
}) => {
  const [mentionType, setMentionType] = useState<MentionType>('none');
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);

  const files = useMemo(() => Object.keys(filesystem), [filesystem]);
  const directories = useMemo(() => {
    const dirs = new Set<string>();
    files.forEach(f => {
      const parts = f.split('/');
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'));
      }
    });
    return Array.from(dirs).filter(Boolean).sort();
  }, [files]);

  const filteredOptions = useMemo(() => {
    if (mentionType === 'category') {
      const cats = [
        { id: 'file', label: 'Files', icon: <FileIcon /> },
        { id: 'dir', label: 'Directories', icon: <FolderIcon /> }
      ];
      return cats.filter(c => c.label.toLowerCase().includes(mentionSearch.toLowerCase()));
    }
    if (mentionType === 'file') {
      return files
        .filter(f => f.toLowerCase().includes(mentionSearch.toLowerCase()))
        .map(f => ({ id: f, label: f, icon: <FileIcon /> }));
    }
    if (mentionType === 'dir') {
      return directories
        .filter(d => d.toLowerCase().includes(mentionSearch.toLowerCase()))
        .map(d => ({ id: d, label: d, icon: <FolderIcon /> }));
    }
    return [];
  }, [mentionType, mentionSearch, files, directories]);

  useEffect(() => {
    setMentionIndex(0);
  }, [filteredOptions.length]);

  const updateMentionState = useCallback((text: string, cursorPosition: number) => {
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || textBeforeCursor[lastAt - 1] === ' ')) {
      const mentionPart = textBeforeCursor.substring(lastAt + 1);
      
      // Close menu if user types a space after the @ or during mention search
      if (mentionPart.includes(' ')) {
        setMentionType('none');
        return;
      }

      if (mentionPart.startsWith('file:')) {
        setMentionType('file');
        setMentionSearch(mentionPart.substring(5));
      } else if (mentionPart.startsWith('dir:')) {
        setMentionType('dir');
        setMentionSearch(mentionPart.substring(4));
      } else {
        setMentionType('category');
        setMentionSearch(mentionPart);
      }
    } else {
      setMentionType('none');
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);
    updateMentionState(val, e.target.selectionStart);
  };

  const selectOption = useCallback((option: { id: string, label: string }) => {
    if (!inputRef.current) return;
    const cursorPosition = inputRef.current.selectionStart;
    const textBeforeCursor = inputValue.substring(0, cursorPosition);
    const textAfterCursor = inputValue.substring(cursorPosition);
    
    const lastAt = textBeforeCursor.lastIndexOf('@');
    
    let newVal = '';
    let newCursorPos = 0;

    if (mentionType === 'category') {
      newVal = `${textBeforeCursor.substring(0, lastAt)}@${option.id}:${textAfterCursor}`;
      newCursorPos = textBeforeCursor.substring(0, lastAt).length + option.id.length + 2;
      setInputValue(newVal);
      updateMentionState(newVal, newCursorPos);
    } else {
      // Just add the raw text @mention
      const mentionText = `@${mentionType}:${option.label} `;
      const startOfText = textBeforeCursor.substring(0, lastAt);
      newVal = startOfText + mentionText + textAfterCursor;
      newCursorPos = startOfText.length + mentionText.length;
      
      setInputValue(newVal);
      setMentionType('none');
    }
    
    // Focus back and set cursor
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [inputValue, mentionType, inputRef, setInputValue, updateMentionState]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionType !== 'none') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredOptions.length > 0) {
          setMentionIndex(prev => (prev + 1) % filteredOptions.length);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredOptions.length > 0) {
          setMentionIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
        }
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && filteredOptions.length > 0) {
        e.preventDefault();
        selectOption(filteredOptions[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionType('none');
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendAction();
    }
  };

  const handleSendAction = () => {
    if (!inputValue.trim()) return;
    onSend(inputValue);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  return (
    <div style={{ width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {mentionType !== 'none' && (
        <div 
          className="mention-menu"
          style={{
            width: 'calc(100% - 32px)',
            maxWidth: '500px',
            backgroundColor: 'var(--agent-bg-terminal-header)',
            color: 'var(--agent-text-white)',
            borderRadius: '12px',
            boxShadow: 'var(--agent-menu-shadow)',
            marginBottom: '8px',
            overflow: 'hidden',
            zIndex: 1000,
            border: '1px solid var(--agent-border-menu)',
            animation: 'slideUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '10px 16px', color: 'var(--agent-text-muted)', fontSize: '13px' }}>No matching results</div>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {filteredOptions.map((option, idx) => (
                <div 
                  key={option.id}
                  onClick={() => selectOption(option)}
                  onMouseEnter={() => setMentionIndex(idx)}
                  style={{
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: idx === mentionIndex ? 'var(--agent-accent-hover)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.1s ease',
                    borderLeft: idx === mentionIndex ? '3px solid var(--agent-text-on-dark)' : '3px solid transparent',
                    paddingLeft: idx === mentionIndex ? '13px' : '16px', // Compensate for border
                  }}
                >
                  <span style={{ color: 'var(--agent-text-white)', display: 'flex', opacity: idx === mentionIndex ? 1 : 0.7 }}>
                    {option.icon}
                  </span>
                  <span style={{ flexGrow: 1, color: idx === mentionIndex ? 'var(--agent-text-white)' : 'var(--agent-text-on-dark-dim)' }}>{option.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div 
        className="chat-input-container"
        style={{ 
          position: 'relative', 
          width: '100%',
          display: 'flex', 
          flexDirection: 'column',
          border: '1px solid var(--agent-border-main)',
          borderRadius: '16px',
          backgroundColor: 'var(--agent-bg-main)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: 'var(--agent-card-shadow)',
          overflow: 'hidden',
          paddingBottom: '40px' // Space for the send button area
        }}
      >

        <textarea 
          ref={inputRef}
          aria-label="Message assistant..."
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            (e.currentTarget.parentNode as HTMLDivElement).style.borderColor = 'var(--agent-bg-dark)';
            (e.currentTarget.parentNode as HTMLDivElement).style.boxShadow = '0 0 0 1px rgba(31, 31, 31, 0.1)';
          }}
          onBlur={(e) => {
            (e.currentTarget.parentNode as HTMLDivElement).style.borderColor = 'var(--agent-border-main)';
            (e.currentTarget.parentNode as HTMLDivElement).style.boxShadow = 'var(--agent-card-shadow)';
          }}
          style={{
            width: '100%',
            padding: '12px 14px 8px 14px',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--agent-text-main)',
            fontSize: '14px',
            outline: 'none',
            resize: 'none',
            minHeight: '48px',
            height: `${useTextHeight(inputValue || ' ', '14px Inter', sidebarWidth, 21, 20)}px`,
            maxHeight: '200px',
            lineHeight: '1.5',
            fontFamily: 'inherit',
            overflowY: 'auto'
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
                  backgroundColor: 'var(--agent-bg-subtle)',
                  color: 'var(--agent-error)',
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
            onClick={handleSendAction}
            disabled={isProcessing || !inputValue.trim()}
            style={{
                backgroundColor: inputValue.trim() ? 'var(--agent-bg-dark)' : 'var(--agent-bg-subtle)',
                color: inputValue.trim() ? 'var(--agent-text-white)' : 'var(--agent-text-muted)',
                border: inputValue.trim() ? '1px solid var(--agent-bg-dark)' : 'none',
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
                opacity: isProcessing ? 0.5 : 1,
                boxShadow: inputValue.trim() ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
            }}
          >
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
};
