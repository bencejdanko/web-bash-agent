import React, { useState, useRef } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { BashSandbox } from './bashSandbox';
import { LlmBridge } from './llmBridge';

// Modular Components
import { SidebarHeader } from './components/SidebarHeader';
import { FloatingToggleButton } from './components/FloatingToggleButton';
import { MessageTurns } from './components/MessageTurns';
import { ChatInput } from './components/ChatInput';
import { HistoryPanel } from './components/HistoryPanel';
import { Message, AgentSidebarProps } from './types';

// Custom Hooks
import { useSidebarWidth } from './hooks/useSidebarWidth';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useHistoryPersistence } from './hooks/useHistoryPersistence';
import { useAgentChat } from './hooks/useAgentChat';
import { useAgentInitialization } from './hooks/useAgentInitialization';

import './AgentSidebar.css';

export const AgentSidebar: React.FC<AgentSidebarProps> = (props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedTurnIds, setCollapsedTurnIds] = useState<string[]>([]);
  const [collapsedThoughtIds, setCollapsedThoughtIds] = useState<string[]>([]);
  
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize sandbox and LLM bridge
  const { bashSandbox, llmBridge } = useAgentInitialization(props);

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
    llmBridge
  );

  const toggleTurn = (turnId: string) => {
    setCollapsedTurnIds(prev => prev.includes(turnId) ? prev.filter(id => id !== turnId) : [...prev, turnId]);
  };

  const toggleThought = (thoughtId: string) => {
    setCollapsedThoughtIds(prev => prev.includes(thoughtId) ? prev.filter(id => id !== thoughtId) : [...prev, thoughtId]);
  };

  return (
    <>
      {isCollapsed && <FloatingToggleButton onClick={() => setIsCollapsed(false)} />}
      
      <div 
        className={`agent-sidebar-layout-container ${isCollapsed ? 'collapsed' : ''}`}
        style={{
          position: 'fixed',
          right: 0, top: 0, bottom: 0, left: 0,
          pointerEvents: 'none',
          zIndex: 9998,
          display: 'flex',
          flexDirection: 'row',
          transform: isCollapsed ? 'translateX(100%)' : 'translateX(0)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <Group direction="horizontal">
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
              backgroundColor: 'var(--agent-bg-main)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              boxShadow: 'var(--agent-sidebar-shadow)',
            }}
          >
            <SidebarHeader 
              onCollapse={() => setIsCollapsed(true)} 
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
                transition: 'flex-grow 0.8s cubic-bezier(0.16, 1, 0.3, 1), padding 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div className="message-list-wrapper" style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '24px',
                opacity: hasStarted ? 1 : 0,
                transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
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
                filesystem={props.filesystem}
              />
            </div>
          </Panel>
        </Group>
      </div>
    </>
  );
};

