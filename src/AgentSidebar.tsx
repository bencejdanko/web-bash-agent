import React, { useState, useRef } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { BashSandbox, normalizeSitePath } from './bashSandbox';
import { LlmBridge } from './llmBridge';
import { SidebarHeader } from './components/SidebarHeader';
import { FloatingToggleButton } from './components/FloatingToggleButton';
import { MessageTurns } from './components/MessageTurns';
import { ChatInput } from './components/ChatInput';
import { HistoryPanel } from './components/HistoryPanel';
import { GalaxyBackground } from './components/GalaxyBackground';
import { Message, AgentSidebarProps } from './types';
import { useSidebarWidth } from './hooks/useSidebarWidth';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useHistoryPersistence } from './hooks/useHistoryPersistence';
import { useAgentChat } from './hooks/useAgentChat';
import { useAgentInitialization } from './hooks/useAgentInitialization';
import { useEffect } from 'react';

import './AgentSidebar.css';

/**
 * WARNING TO ALL AGENTS:
 * DO NOT ADD "BOUNCY" OR "SPRING" PHYSICS ANIMATIONS TO THIS UI.
 * THE USER FINDS THEM EXTREMELY ANNOYING.
 * KEEP ALL TRANSITIONS SNAPPY (0.4s OR LESS) AND USE SIMPLE EASING (ease-out or expo-out).
 * NO "WEIGHTY", "PREMIUM", OR "FLUID" PHYSICS.
 */

export const AgentSidebar: React.FC<AgentSidebarProps> = (props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [transitionStatus, setTransitionStatus] = useState<'none' | 'closing' | 'opening'>('none');
  const [collapsedTurnIds, setCollapsedTurnIds] = useState<string[]>([]);
  const [collapsedThoughtIds, setCollapsedThoughtIds] = useState<string[]>([]);
  
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [actualFilesystem, setActualFilesystem] = useState<Record<string, string>>({});

  // Initialize sandbox and LLM bridge
  const { bashSandbox, llmBridge } = useAgentInitialization(props);

  // Sync filesystem whenever sandbox is initialized or props change
  React.useEffect(() => {
    if (bashSandbox) {
        setActualFilesystem(bashSandbox.getFilesystem());
    }
  }, [bashSandbox, props.filesystem]);

  // Use custom hooks for modular logic
  const sidebarWidth = useSidebarWidth(sidebarContentRef);
  
  const { handleScroll } = useAutoScroll(sidebarContentRef, [messages, collapsedTurnIds]);

  const { 
    conversations, 
    currentConversationId, 
    handleNewChat, 
    handleSelectConversation, 
    handleDeleteConversation 
  } = useHistoryPersistence(messages, setMessages, setHasStarted);

  const { 
    isProcessing, 
    turnStartTime, 
    handleSend, 
    handleCancel 
  } = useAgentChat(
    props, 
    messages, 
    setMessages, 
    hasStarted, 
    setHasStarted, 
    setIsExpanding,
    bashSandbox,
    llmBridge,
    (files) => setActualFilesystem(files)
  );

  const toggleTurn = (turnId: string) => {
    setCollapsedTurnIds(prev => prev.includes(turnId) ? prev.filter(id => id !== turnId) : [...prev, turnId]);
  };

  const toggleThought = (thoughtId: string) => {
    setCollapsedThoughtIds(prev => prev.includes(thoughtId) ? prev.filter(id => id !== thoughtId) : [...prev, thoughtId]);
  };

  useEffect(() => {
    // Initial slide-in on load
    handleOpen();
  }, []);

  const handleCollapse = () => {
    setIsCollapsed(true);
    setTransitionStatus('none');
  };

  const handleOpen = () => {
    setIsCollapsed(false);
    setTransitionStatus('none');
  };

  const isBreathedOut = hasStarted || transitionStatus !== 'none';
  const isPadded = !isBreathedOut;

  return (
    <>
      {isCollapsed && <FloatingToggleButton onClick={handleOpen} />}
      
      <div className={`agent-sidebar-layout-container ${isCollapsed ? 'collapsed' : ''}`}>
        <Group orientation="horizontal" style={{ height: '100%', width: '100%' }}>
          <Panel style={{ pointerEvents: 'none' }} /> 
          
          <Separator 
            className="sidebar-resize-handle" 
            style={{ pointerEvents: 'auto' }}
          />

          <Panel 
            defaultSize={500} 
            minSize={320} 
            maxSize={1000}
            className="agent-sidebar-container"
            style={{ 
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              position: 'relative'
            }}
          >
            <GalaxyBackground />
            <div 
              className={`agent-panel-inner ${isPadded ? 'padded' : ''}`}
              style={{ flexGrow: 1, zIndex: 1 }}
            >
              <SidebarHeader 
                onCollapse={handleCollapse} 
                onNewChat={() => { handleNewChat(); setShowHistory(false); setIsExpanding(false); }}
                onToggleHistory={() => setShowHistory(!showHistory)}
              />

              {showHistory && (
                <HistoryPanel 
                  conversations={conversations}
                  currentConversationId={currentConversationId}
                  onSelectConversation={(id) => { handleSelectConversation(id); setShowHistory(false); }}
                  onDeleteConversation={handleDeleteConversation}
                  onClose={() => setShowHistory(false)}
                />
              )}

              <div 
                ref={sidebarContentRef}
                onScroll={handleScroll}
                className="agent-scrollbar"
                style={{
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  flexGrow: hasStarted ? 1 : 0,
                  flexShrink: hasStarted ? 1 : 0,
                  flexBasis: 0,
                  padding: hasStarted ? '12px 16px' : '0',
                  transition: 'flex-grow 0.4s var(--agent-transition-smooth), padding 0.4s var(--agent-transition-smooth)',
                }}
              >
                <div className="message-list-wrapper" style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '24px',
                  opacity: hasStarted ? 1 : 0,
                  transition: 'opacity 0.4s var(--agent-transition-smooth)',
                  pointerEvents: hasStarted ? 'auto' : 'none',
                  overflow: hasStarted ? 'visible' : 'hidden',
                }}>
                  <MessageTurns 
                    messages={messages}
                    isProcessing={isProcessing}
                    turnStartTime={turnStartTime}
                    collapsedTurnIds={collapsedTurnIds}
                    onToggleTurn={toggleTurn}
                    collapsedThoughtIds={collapsedThoughtIds}
                    onToggleThought={toggleThought}
                    bashSandbox={bashSandbox}
                    sidebarWidth={sidebarWidth}
                  />
                  <div ref={messagesEndRef} style={{ height: '40px' }} />
                </div>
              </div>

              <div className={`chat-footer-wrapper ${!hasStarted ? 'centered' : 'bottom'} ${isExpanding ? 'expanding' : ''}`}>
                <ChatInput 
                  inputValue={inputValue}
                  setInputValue={setInputValue}
                  isProcessing={isProcessing}
                  onSend={(text) => handleSend(text, setInputValue, setCollapsedTurnIds)}
                  onCancel={handleCancel}
                  inputRef={inputRef}
                  sidebarWidth={sidebarWidth}
                  placeholder="Ask anything, @ to mention, / for SKILL"
                  filesystem={actualFilesystem}
                />
              </div>
            </div>
          </Panel>
        </Group>
      </div>
    </>
  );
};
