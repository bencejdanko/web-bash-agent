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
  const [attachments, setAttachments] = useState<string[]>([]);

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
      // For file/dir: remove from text and add to attachments section
      const attachment = `@${mentionType}:${option.label}`;
      const startOfText = textBeforeCursor.substring(0, lastAt);
      newVal = startOfText + textAfterCursor;
      newCursorPos = startOfText.length;
      
      setInputValue(newVal);
      setAttachments(prev => prev.includes(attachment) ? prev : [...prev, attachment]);
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
    if (!inputValue.trim() && attachments.length === 0) return;
    const finalContent = attachments.length > 0 
      ? `${inputValue.trim()}\n\nAttachments: ${attachments.join(' ')}`.trim()
      : inputValue;
    onSend(finalContent);
    setAttachments([]);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const removeAttachment = (attachment: string) => {
    setAttachments(prev => prev.filter(a => a !== attachment));
  };

  return (
    <div style={{ width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {mentionType !== 'none' && (
        <div 
          className="mention-menu"
          style={{
            width: 'calc(100% - 32px)',
            maxWidth: '500px',
            backgroundColor: '#1f1f1f',
            color: '#fff',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            marginBottom: '8px',
            overflow: 'hidden',
            zIndex: 1000,
            border: '1px solid #333',
            animation: 'slideUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '10px 16px', color: '#888', fontSize: '13px' }}>No matching results</div>
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
                    backgroundColor: idx === mentionIndex ? '#333' : 'transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'background-color 0.1s ease',
                  }}
                >
                  <span style={{ color: '#7dd3fc', display: 'flex' }}>
                    {option.icon}
                  </span>
                  <span style={{ flexGrow: 1, color: '#eee' }}>{option.label}</span>
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
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          backgroundColor: '#fff',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
          overflow: 'hidden',
          paddingBottom: '40px' // Space for the send button area
        }}
      >
        {attachments.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '12px 14px 4px 14px',
            backgroundColor: '#fff',
            borderBottom: 'none'
          }}>
            {attachments.map(att => (
              <div 
                key={att} 
                className="mention-tag"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '2px 8px',
                  fontSize: '12px'
                }}
              >
                {att.startsWith('@file:') ? <FileIcon /> : <FolderIcon />}
                <span>{att.split(':').slice(1).join(':')}</span>
                <button 
                  onClick={() => removeAttachment(att)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '0 0 0 4px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    lineHeight: 1
                  }}
                  onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea 
          ref={inputRef}
          aria-label="Message assistant..."
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            (e.currentTarget.parentNode as HTMLDivElement).style.borderColor = '#3b82f6';
            (e.currentTarget.parentNode as HTMLDivElement).style.boxShadow = '0 0 0 1px rgba(59, 130, 246, 0.1)';
          }}
          onBlur={(e) => {
            (e.currentTarget.parentNode as HTMLDivElement).style.borderColor = '#e5e7eb';
            (e.currentTarget.parentNode as HTMLDivElement).style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.02)';
          }}
          style={{
            width: '100%',
            padding: '12px 14px 8px 14px',
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
            onClick={handleSendAction}
            disabled={isProcessing || (!inputValue.trim() && attachments.length === 0)}
            style={{
                backgroundColor: (inputValue.trim() || attachments.length > 0) ? '#eff6ff' : '#f3f4f6',
                color: (inputValue.trim() || attachments.length > 0) ? '#1e40af' : '#9ca3af',
                border: (inputValue.trim() || attachments.length > 0) ? '1px solid #dbeafe' : 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: ((inputValue.trim() || attachments.length > 0) && !isProcessing) ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                flexShrink: 0,
                transform: ((inputValue.trim() || attachments.length > 0) && !isProcessing) ? 'scale(1)' : 'scale(0.9)',
                opacity: isProcessing ? 0.5 : 1,
                boxShadow: (inputValue.trim() || attachments.length > 0) ? '0 1px 3px rgba(59, 130, 246, 0.1)' : 'none'
            }}
          >
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
};
