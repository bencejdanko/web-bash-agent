import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTextHeight } from '../hooks/useTextHeight';
import { StopIcon, ArrowRightIcon, FileIcon, FolderIcon, CubeIcon } from './Icons';

import { AgentSkill, ModelConfig } from '../types';

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
  skills?: AgentSkill[];
  onOpenTerminal?: () => void;
  models?: ModelConfig[];
  currentModelId?: string;
  onModelChange?: (id: string) => void;
}

type MentionType = 'none' | 'category' | 'file' | 'dir' | 'skill';


export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  setInputValue,
  isProcessing,
  onSend,
  onCancel,
  inputRef,
  sidebarWidth,
  placeholder = "Ask a question...",
  filesystem = {},
  skills = [],
  onOpenTerminal,
  models = [],
  currentModelId,
  onModelChange
}) => {
  const [mentionType, setMentionType] = useState<MentionType>('none');
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(sidebarWidth);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const files = useMemo(() => Object.keys(filesystem), [filesystem]);
  const directories = useMemo(() => {
    const dirs = new Set<string>();
    files.forEach(f => {
      const parts = f.split('/');
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'));
      }
    });
    return Array.from(dirs).sort();
  }, [files]);

  const currentModel = useMemo(() => models.find(m => m.id === currentModelId) || models[0], [models, currentModelId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    if (mentionType === 'skill') {
      return (skills || [])
        .filter(s => s.name.toLowerCase().includes(mentionSearch.toLowerCase()))
        .map(s => ({ id: s.name, label: s.name, icon: <CubeIcon /> }));
    }
    return [];
  }, [mentionType, mentionSearch, files, directories]);

  useEffect(() => {
    setMentionIndex(0);
  }, [filteredOptions.length]);

  useEffect(() => {
    if (measureRef.current) {
      setContainerWidth(measureRef.current.clientWidth);
    }
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    if (measureRef.current) {
      observer.observe(measureRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const updateMentionState = useCallback((text: string, cursorPosition: number) => {
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || textBeforeCursor[lastAt - 1] === ' ')) {
      const mentionPart = textBeforeCursor.substring(lastAt + 1);
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
      const lastSlash = textBeforeCursor.lastIndexOf('/');
      if (lastSlash !== -1 && (lastSlash === 0 || textBeforeCursor[lastSlash - 1] === ' ')) {
        const mentionPart = textBeforeCursor.substring(lastSlash + 1);
        if (!mentionPart.includes(' ')) {
          setMentionType('skill');
          setMentionSearch(mentionPart);
          return;
        }
      }
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
    const lastSlash = textBeforeCursor.lastIndexOf('/');
    
    let newVal = '';
    let newCursorPos = 0;

    if (mentionType === 'category') {
      newVal = `${textBeforeCursor.substring(0, lastAt)}@${option.id}:${textAfterCursor}`;
      newCursorPos = textBeforeCursor.substring(0, lastAt).length + option.id.length + 2;
      setInputValue(newVal);
      updateMentionState(newVal, newCursorPos);
    } else if (mentionType === 'skill') {
      const mentionText = `/${option.label} `;
      const startOfText = textBeforeCursor.substring(0, lastSlash);
      newVal = startOfText + mentionText + textAfterCursor;
      newCursorPos = startOfText.length + mentionText.length;
      setInputValue(newVal);
      setMentionType('none');
    } else {
      const mentionText = `@${mentionType}:${option.label} `;
      const startOfText = textBeforeCursor.substring(0, lastAt);
      newVal = startOfText + mentionText + textAfterCursor;
      newCursorPos = startOfText.length + mentionText.length;
      setInputValue(newVal);
      setMentionType('none');
    }
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [inputValue, mentionType, inputRef, setInputValue, updateMentionState]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionType !== 'none') {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (filteredOptions.length > 0) setMentionIndex(prev => (prev + 1) % filteredOptions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (filteredOptions.length > 0) setMentionIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length); return; }
      if ((e.key === 'Enter' || e.key === 'Tab') && filteredOptions.length > 0) { e.preventDefault(); selectOption(filteredOptions[mentionIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionType('none'); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendAction(); }
  };

  const handleSendAction = () => {
    if (!inputValue.trim()) return;
    onSend(inputValue);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  return (
    <div style={{ width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="chat-input-inner-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {mentionType !== 'none' && (
          <div className="mention-menu" style={{ width: '100%', backgroundColor: 'var(--agent-bg-terminal-header)', color: 'var(--agent-text-white)', borderRadius: '12px', boxShadow: 'var(--agent-menu-shadow)', marginBottom: '4px', overflow: 'hidden', zIndex: 1000, border: '1px solid var(--agent-border-menu)', animation: 'slideUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            {filteredOptions.length === 0 ? <div style={{ padding: '10px 16px', color: 'var(--agent-text-muted)', fontSize: '13px' }}>No matching results</div> : (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {filteredOptions.map((option, idx) => (
                  <div key={option.id} onClick={() => selectOption(option)} onMouseEnter={() => setMentionIndex(idx)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: idx === mentionIndex ? 'var(--agent-accent-hover)' : 'transparent', cursor: 'pointer', fontSize: '13px', transition: 'all 0.1s ease', borderLeft: idx === mentionIndex ? '3px solid var(--agent-text-on-dark)' : '3px solid transparent', paddingLeft: idx === mentionIndex ? '13px' : '16px' }}>
                    <span style={{ color: 'var(--agent-text-white)', display: 'flex', opacity: idx === mentionIndex ? 1 : 0.7 }}>{option.icon}</span>
                    <span style={{ flexGrow: 1, color: idx === mentionIndex ? 'var(--agent-text-white)' : 'var(--agent-text-on-dark-dim)' }}>{option.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div ref={measureRef} className="chat-input-container" style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', border: '1px solid var(--agent-border-main)', borderRadius: '16px', backgroundColor: 'var(--agent-bg-main)', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: 'var(--agent-card-shadow)', overflow: 'hidden', paddingBottom: '32px' }}>
          <textarea ref={inputRef} aria-label="Message assistant..." placeholder={placeholder} value={inputValue} onChange={handleInputChange} onKeyDown={handleKeyDown} onFocus={(e) => { (e.currentTarget.parentNode as HTMLDivElement).style.borderColor = 'var(--agent-accent)'; (e.currentTarget.parentNode as HTMLDivElement).style.boxShadow = 'var(--agent-shadow-subtle)'; }} onBlur={(e) => { (e.currentTarget.parentNode as HTMLDivElement).style.borderColor = 'var(--agent-border-main)'; (e.currentTarget.parentNode as HTMLDivElement).style.boxShadow = 'var(--agent-card-shadow)'; }} style={{ width: '100%', boxSizing: 'border-box', padding: 'var(--agent-input-padding)', paddingBottom: '8px', border: 'none', backgroundColor: 'transparent', color: 'var(--agent-text-main)', fontSize: '14px', outline: 'none', resize: 'none', minHeight: '48px', height: `${useTextHeight(inputValue || ' ', '14px Inter', containerWidth, 21, 20)}px`, maxHeight: '200px', lineHeight: '1.5', fontFamily: 'inherit', overflowY: 'auto' }} disabled={isProcessing} />
          <div style={{ position: 'absolute', right: '10px', bottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isProcessing && <button onClick={onCancel} style={{ backgroundColor: 'var(--agent-bg-subtle)', color: 'var(--agent-error)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)', flexShrink: 0, boxShadow: 'var(--agent-shadow-button)' }} title="Cancel processing"><StopIcon /></button>}
            <button onClick={handleSendAction} disabled={isProcessing || !inputValue.trim()} style={{ backgroundColor: inputValue.trim() ? 'var(--agent-bg-dark)' : 'var(--agent-bg-subtle)', color: inputValue.trim() ? 'var(--agent-text-white)' : 'var(--agent-text-muted)', border: inputValue.trim() ? '1px solid var(--agent-bg-dark)' : 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: (inputValue.trim() && !isProcessing) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)', flexShrink: 0, transform: (inputValue.trim() && !isProcessing) ? 'scale(1)' : 'scale(0.9)', opacity: isProcessing ? 0.5 : 1, boxShadow: inputValue.trim() ? 'var(--agent-shadow-button)' : 'none' }}><ArrowRightIcon /></button>
          </div>
        </div>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start', padding: '0 4px', gap: '12px', alignItems: 'center' }}>
          {onOpenTerminal && (
              <button onClick={onOpenTerminal} className="chat-input-terminal-btn-minimal" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--agent-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0', opacity: 0.7, transition: 'opacity 0.2s' }} onMouseOver={(e) => e.currentTarget.style.opacity = '1'} onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}>
                  <CubeIcon size={14} />
                  <span>Open terminal</span>
              </button>
          )}

          {models.length > 0 && (
              <div style={{ position: 'relative' }} ref={modelMenuRef}>
                  <button 
                    onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--agent-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0', opacity: 0.7, transition: 'opacity 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                  >
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--agent-accent)' }} />
                      <span>{currentModel?.name}</span>
                  </button>
                  {isModelMenuOpen && (
                      <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px', width: '220px', backgroundColor: 'var(--agent-bg-main)', border: '1px solid var(--agent-border-main)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 1000, animation: 'slideUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                          <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                              {models.map((m) => (
                                  <div 
                                      key={m.id} 
                                      onClick={() => { onModelChange?.(m.id); setIsModelMenuOpen(false); }}
                                      style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: m.id === currentModelId ? 'var(--agent-accent)' : 'var(--agent-text-main)', backgroundColor: m.id === currentModelId ? 'var(--agent-bg-subtle)' : 'transparent', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s ease' }}
                                      onMouseOver={(e) => { if (m.id !== currentModelId) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'; }}
                                      onMouseOut={(e) => { if (m.id !== currentModelId) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                  >
                                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: m.id === currentModelId ? 'var(--agent-accent)' : 'transparent', border: m.id === currentModelId ? 'none' : '1px solid var(--agent-border-main)' }} />
                                      <div style={{ flexGrow: 1 }}>{m.name}</div>
                                      {m.id === currentModelId && <div style={{ fontSize: '10px', color: 'var(--agent-accent)', fontWeight: 600 }}>Active</div>}
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
          )}
        </div>
      </div>
    </div>
  );
};
