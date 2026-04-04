import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { BashSandbox } from './bashSandbox';
import { LlmBridge } from './llmBridge';
import { Panel, Group, Separator } from 'react-resizable-panels';

// Modular Components
import { SidebarHeader } from './components/SidebarHeader';
import { FloatingToggleButton } from './components/FloatingToggleButton';
import { MessageTurns } from './components/MessageTurns';
import { TerminalBox } from './components/TerminalBox';
import { ChatInput } from './components/ChatInput';
import { HistoryPanel } from './components/HistoryPanel';
import { Conversation, Message, AgentSidebarProps } from './types';

import './AgentSidebar.css';

export const AgentSidebar: React.FC<AgentSidebarProps> = (props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnStartTime, setTurnStartTime] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedTurnIds, setCollapsedTurnIds] = useState<string[]>([]);
  const [collapsedThoughtIds, setCollapsedThoughtIds] = useState<string[]>([]);
  const isAtBottomRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Measure sidebar width for pretext (used in ChatInput)
  const [sidebarWidth, setSidebarWidth] = useState(380);
  useLayoutEffect(() => {
    if (sidebarContentRef.current) {
      setSidebarWidth(sidebarContentRef.current.clientWidth - 32); // subtract padding
    }
    
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setSidebarWidth(entries[0].contentRect.width - 32);
      }
    });
    
    if (sidebarContentRef.current) {
      observer.observe(sidebarContentRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedConversations = localStorage.getItem('agent_conversations');
    if (savedConversations) {
      const parsed = JSON.parse(savedConversations);
      setConversations(parsed);
      
      // If there's a last active conversation, load it
      const lastActiveId = localStorage.getItem('agent_active_conversation_id');
      if (lastActiveId && parsed.some((c: Conversation) => c.id === lastActiveId)) {
        const lastConv = parsed.find((c: Conversation) => c.id === lastActiveId);
        setCurrentConversationId(lastActiveId);
        setMessages(lastConv.messages);
      }
    }
  }, []);

  // Save current conversation to history
  useEffect(() => {
    if (messages.length === 0 && !currentConversationId) return;

    let convId = currentConversationId;
    let newConversations = [...conversations];
    
    if (!convId) {
      convId = `conv-${Date.now()}`;
      setCurrentConversationId(convId);
      localStorage.setItem('agent_active_conversation_id', convId);
    }

    const existingIndex = newConversations.findIndex(c => c.id === convId);
    const firstPrompt = messages.find(m => m.role === 'user')?.content || '';
    const title = firstPrompt ? (firstPrompt.slice(0, 40) + (firstPrompt.length > 40 ? '...' : '')) : 'New Chat';

    const conversation: Conversation = {
      id: convId as string,
      title: title,
      messages: messages,
      createdAt: existingIndex >= 0 ? newConversations[existingIndex].createdAt : Date.now(),
      updatedAt: Date.now()
    };

    if (existingIndex >= 0) {
      newConversations[existingIndex] = conversation;
    } else {
      newConversations.push(conversation);
    }

    setConversations(newConversations);
    localStorage.setItem('agent_conversations', JSON.stringify(newConversations));
  }, [messages]);

  const bashSandboxRef = useRef<any>(null);
  const llmBridgeRef = useRef<any>(null);

  if (!bashSandboxRef.current) {
    const pf = typeof window !== 'undefined' ? (window as any).pagefind : null;
    bashSandboxRef.current = props.bashSandbox || new BashSandbox({
      files: props.filesystem || {},
      pagefind: pf,
    });
  }

  if (!llmBridgeRef.current) {
    llmBridgeRef.current = props.llmBridge || new LlmBridge({
      apiKey: props.apiKey || '',
      baseURL: 'https://openrouter.ai/api/v1',
      dangerouslyAllowBrowser: true,
    }, props.model || 'openai/gpt-4o-mini');
  }

  // Auto-scroll to bottom of sidebar
  useLayoutEffect(() => {
    const container = sidebarContentRef.current;
    if (!container) return;

    const scrollToBottom = () => {
      if (isAtBottomRef.current || isProcessing) {
        container.scrollTop = container.scrollHeight;
      }
    };

    scrollToBottom();

    const observer = new ResizeObserver(() => {
      scrollToBottom();
    });

    const wrapper = container.querySelector('.message-list-wrapper');
    if (wrapper) {
      observer.observe(wrapper);
    }

    return () => observer.disconnect();
  }, [messages, isProcessing, collapsedTurnIds]);

  const handleScroll = () => {
    const container = sidebarContentRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
      isAtBottomRef.current = isAtBottom;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setTurnStartTime(null);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const turnId = `turn-${Date.now()}`;
    const userMessage: Message = { role: 'user', content: text, turnId };
    let currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInputValue('');
    setIsProcessing(true);
    const turnStart = Date.now();
    setTurnStartTime(turnStart);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let isWorking = true;
      let iterations = 0;
      
      while (isWorking && iterations < 15) {
        if (controller.signal.aborted) break;
        iterations++;
        const iterId = `iter-${Date.now()}-${iterations}`;

        const callStartTime = Date.now();
        const llmResponse = await llmBridgeRef.current.chat(currentMessages, { 
          reasoning_effort: props.reasoningEffort || 'low',
          include_thinking: props.includeThinking || true,
          signal: controller.signal
        });
        
        if (controller.signal.aborted) break;
        const callEndTime = Date.now();
        
        const assistantMessage = llmResponse.message as Message;
        assistantMessage.iterationId = iterId;
        assistantMessage.turnId = turnId;
        assistantMessage.thinkingTime = Math.round((callEndTime - callStartTime) / 1000);
        
        const msg = llmResponse.message as any;
        assistantMessage.reasoning_content = 
            msg.reasoning_content || 
            msg.reasoning || 
            msg.thought || 
            (msg.reasoning_details?.[0]?.text);

        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          const toolResults: Message[] = [];
          
          for (const toolCall of assistantMessage.tool_calls) {
            if (controller.signal.aborted) break;
            if (toolCall.function.name === 'bash') {
              const { command } = JSON.parse(toolCall.function.arguments);
              const result = await bashSandboxRef.current.exec(command);
              
              let output = '';
              if (result.stdout) output += result.stdout;
              if (result.stderr) output += result.stderr;
              if (!output.trim()) output = '(no output)';

              toolResults.push({
                role: 'tool',
                content: output,
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                iterationId: iterId,
                turnId: turnId
              });
            }
          }
          
          if (controller.signal.aborted) break;
          currentMessages = [...currentMessages, assistantMessage, ...toolResults];
          setMessages(currentMessages);
        } else {
          currentMessages = [...currentMessages, assistantMessage];
          setMessages(currentMessages);
          isWorking = false;
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'APIUserAbortError' || controller.signal.aborted) {
        console.log('Chat cancelled by user');
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Check console for details.' }]);
        console.error('Agent error:', error);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsProcessing(false);
      setTurnStartTime(null);
      
      const turnEnd = Date.now();
      const finalDuration = Math.round((turnEnd - turnStart) / 1000);
      
      setMessages(prev => prev.map(m => 
        m.turnId === turnId && m.role === 'user' 
          ? { ...m, turnDuration: finalDuration }
          : m
      ));

      if (turnId && !controller.signal.aborted) {
        setCollapsedTurnIds(prev => [...new Set([...prev, turnId])]);
      }
    }
  };

  const toggleTurn = (turnId: string) => {
    setCollapsedTurnIds(prev => 
      prev.includes(turnId) 
        ? prev.filter(id => id !== turnId) 
        : [...prev, turnId]
    );
  };

  const toggleThought = (thoughtId: string) => {
    setCollapsedThoughtIds(prev => 
      prev.includes(thoughtId) 
        ? prev.filter(id => id !== thoughtId) 
        : [...prev, thoughtId]
    );
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
    localStorage.removeItem('agent_active_conversation_id');
    setShowHistory(false);
  };

  const handleSelectConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversationId(id);
      setMessages(conv.messages);
      localStorage.setItem('agent_active_conversation_id', id);
      setShowHistory(false);
    }
  };

  const handleDeleteConversation = (id: string) => {
    const newConversations = conversations.filter(c => c.id !== id);
    setConversations(newConversations);
    localStorage.setItem('agent_conversations', JSON.stringify(newConversations));
    
    if (currentConversationId === id) {
      setMessages([]);
      setCurrentConversationId(null);
      localStorage.removeItem('agent_active_conversation_id');
    }
  };

  return (
    <>
    {isCollapsed && <FloatingToggleButton onClick={() => setIsCollapsed(false)} />}
    
    <div 
      className={`agent-sidebar-layout-container ${isCollapsed ? 'collapsed' : ''}`}
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        left: 0,
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
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            boxShadow: '-4px 0 15px -3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <SidebarHeader 
            onCollapse={() => setIsCollapsed(true)} 
            onNewChat={handleNewChat}
            onToggleHistory={() => setShowHistory(!showHistory)}
          />

          {showHistory && (
            <HistoryPanel 
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
              onClose={() => setShowHistory(false)}
            />
          )}

          <div 
            ref={sidebarContentRef}
            onScroll={handleScroll}
            className="agent-scrollbar"
            style={{
              flex: messages.length === 0 ? 0 : 1,
              padding: messages.length === 0 ? '0' : '12px 16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              scrollBehavior: 'smooth',
              transition: 'flex 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div className="message-list-wrapper" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '24px',
              opacity: messages.length === 0 ? 0 : 1,
              transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: messages.length === 0 ? 'none' : 'auto',
              height: messages.length === 0 ? 0 : 'auto',
              overflow: messages.length === 0 ? 'hidden' : 'visible',
            }}>
              <MessageTurns 
                messages={messages}
                isProcessing={isProcessing}
                turnStartTime={turnStartTime}
                collapsedTurnIds={collapsedTurnIds}
                onToggleTurn={toggleTurn}
                collapsedThoughtIds={collapsedThoughtIds}
                onToggleThought={toggleThought}
              />
              <div ref={messagesEndRef} style={{ height: '40px' }} />
            </div>
          </div>

          <div className={`chat-footer-wrapper ${messages.length === 0 ? 'centered' : 'bottom'}`}>
            <ChatInput 
              inputValue={inputValue}
              setInputValue={setInputValue}
              isProcessing={isProcessing}
              onSend={handleSend}
              onCancel={handleCancel}
              inputRef={inputRef}
              sidebarWidth={sidebarWidth}
              placeholder="Ask anything, @ to mention, / for workflows"
            />
          </div>
        </Panel>
      </Group>
    </div>
    </>
  );
};

