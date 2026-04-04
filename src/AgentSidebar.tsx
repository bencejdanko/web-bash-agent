import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { prepare, layout } from '@chenglou/pretext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BashSandbox } from './bashSandbox';
import { LlmBridge } from './llmBridge';

export interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
  reasoning_content?: string;
  iterationId?: string;
  thinkingTime?: number;
  turnId?: string;
}

export interface AgentSidebarProps {
    bashSandbox?: any;
    llmBridge?: any;
    apiKey?: string;
    model?: string;
    filesystem?: Record<string, string>;
    reasoningEffort?: 'low' | 'medium' | 'high';
    includeThinking?: boolean;
}

// Icons
const BotIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6' }}>
    <path d="M12 8V4H8"></path>
    <rect width="16" height="12" x="4" y="8" rx="2"></rect>
    <path d="M2 14h2"></path>
    <path d="M20 14h2"></path>
    <path d="M15 13v2"></path>
    <path d="M9 13v2"></path>
  </svg>
);

const SendIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
);

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>
);

const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="1" />
  </svg>
);

const CommandIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
    <polyline points="4 17 10 11 4 5"></polyline>
    <line x1="12" y1="19" x2="20" y2="19"></line>
  </svg>
);

const ChevronRight = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
);

const ChevronLeft = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
);

const RelocateIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6"></path>
      <path d="M10 14L21 3"></path>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    </svg>
);

const CopyIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
    </svg>
);

/**
 * Premium Markdown Renderer
 */
const MarkdownOutput: React.FC<{ content: string; className?: string; color?: string }> = ({ content, className, color = '#111827' }) => {
  return (
    <div className={`markdown-output ${className || ''}`} style={{ fontSize: '14px', color, lineHeight: '1.6' }}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          ul: ({node, ...props}) => <ul style={{ paddingLeft: '20px', marginBottom: '12px' }} {...props} />,
          ol: ({node, ...props}) => <ol style={{ paddingLeft: '20px', marginBottom: '12px' }} {...props} />,
          li: ({node, ...props}) => <li style={{ marginBottom: '4px' }} {...props} />,
          code: ({node, ...props}) => <code style={{ backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '4px', fontSize: '0.9em', fontFamily: 'JetBrains Mono', color: '#111827' }} {...props} />,
          strong: ({node, ...props}) => <strong style={{ fontWeight: 600, color: 'inherit' }} {...props} />,
          p: ({node, ...props}) => <p style={{ marginBottom: '12px', color: 'inherit' }} {...props} />,
          h1: ({node, ...props}) => <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'inherit' }} {...props} />,
          h2: ({node, ...props}) => <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'inherit' }} {...props} />,
          h3: ({node, ...props}) => <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: 'inherit' }} {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

/**
 * Helper to measure text height using Pretext
 */
const useTextHeight = (text: string, font: string, width: number, lineHeight: number, extraPadding = 0) => {
  return useMemo(() => {
    if (!text || width <= 0) return 0;
    try {
      const prepared = prepare(text, font, { whiteSpace: 'pre-wrap' });
      const { height } = layout(prepared, width, lineHeight);
      return height + extraPadding;
    } catch (e) {
      console.warn('Pretext layout failed:', e);
      return 0;
    }
  }, [text, font, width, lineHeight, extraPadding]);
};

/**
 * ThinkingBlock handles reasoning content with internal auto-scrolling
 */
const ThinkingBlock: React.FC<{ content: string; isActive: boolean }> = ({ content, isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (containerRef.current && isActive) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isActive]);

  return (
    <div 
      ref={containerRef}
      className="thinking-scroll-container"
    >
      <MarkdownOutput content={content} className="reasoning-markdown" color="#374151" />
    </div>
  );
};

/**
 * Live timer component for real-time counting
 */
const LiveTimer: React.FC<{ startTime: number }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <>{elapsed}s</>;
};

/**
 * WorkBlock handles the grouping of thoughts and tool calls into a single collapsible.
 */
/**
 * Generic Collapsible component for work sessions and reasoning thoughts
 */
const Collapsible: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  showBorder?: boolean;
}> = ({ isOpen, onToggle, title, children, showBorder = true }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | string>(isOpen ? 'auto' : 0);

  useLayoutEffect(() => {
    if (isOpen && contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [isOpen, children]);

  return (
    <div style={{ marginBottom: '4px' }}>
      <button 
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          userSelect: 'none',
          padding: '4px 0',
          backgroundColor: 'transparent',
          border: 'none',
          fontSize: '13px',
          color: '#94a3b8',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
          textAlign: 'left',
          width: 'fit-content'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.color = '#64748b';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.color = '#94a3b8';
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '14px',
          height: '14px',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          opacity: 0.7,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <span style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
          {title}
        </span>
      </button>
      
      <div 
        style={{ 
          height: typeof height === 'number' ? `${height}px` : height,
          overflow: 'hidden',
          transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div ref={contentRef} style={{ 
          padding: '4px 0 8px 14px',
          borderLeft: showBorder ? '1px solid #f1f5f9' : 'none',
          marginLeft: '6px',
          marginTop: '2px'
        }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export const AgentSidebar: React.FC<AgentSidebarProps> = (props) => {
  const [messages, setMessages] = useState<Message[]>([]);
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

  // Measure sidebar width for pretext
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

    // Immediate scroll when dependencies change
    scrollToBottom();

    // Use ResizeObserver to handle smooth expansions (like WorkBlock) or streamed content
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
      
      // Store the final duration in the user message for this turn
      setMessages(prev => prev.map(m => 
        m.turnId === turnId && m.role === 'user' 
          ? { ...m, turnDuration: finalDuration } as any
          : m
      ));

      // Auto-collapse the work session when done
      if (turnId && !controller.signal.aborted) {
        setCollapsedTurnIds(prev => [...new Set([...prev, turnId])]);
      }
    }
  };

  return (
    <>
    {isCollapsed && (
      <button
        onClick={() => setIsCollapsed(false)}
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
    )}
    <div 
      className={`agent-sidebar-container ${isCollapsed ? 'collapsed' : ''}`}
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '420px',
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #e5e7eb',
        boxShadow: '-4px 0 15px -3px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9998,
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        transform: isCollapsed ? 'translateX(100%)' : 'translateX(0)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        
        .agent-sidebar-container {
          animation: agentSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        @keyframes agentSlideIn {
          from { transform: translateX(30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        .agent-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        
        .agent-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .agent-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        
        .agent-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }

        .terminal-box {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 10px;
          padding: 0;
          overflow: hidden;
          margin: 12px 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .terminal-header {
          background: #27272a;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          color: #a1a1aa;
        }

        .terminal-footer {
          border-top: 1px solid #27272a;
          padding: 6px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          color: #71717a;
        }

        .user-bubble {
          background: #f3f4f6;
          padding: 10px 14px;
          border-radius: 14px 14px 2px 14px;
          color: #111827;
          font-size: 14px;
          align-self: flex-end;
          max-width: 85%;
          line-height: 1.5;
          margin-left: auto;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .assistant-message-container {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-width: 100%;
        }

        @keyframes agentFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes agentPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        .terminal-content {
          padding: 12px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #e5e7eb;
        }

        .terminal-command-line {
          color: #e5e7eb;
          margin-bottom: 8px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          word-break: break-all;
        }

        .breadcrumb {
          color: #71717a;
          font-size: 11px;
        }


        .thinking-scroll-container {
          max-height: 220px;
          overflow-y: auto;
          position: relative;
          padding: 4px 0;
          scrollbar-width: none;
          margin-bottom: 8px;
        }

        .thinking-scroll-container::-webkit-scrollbar {
          display: none;
        }

        @keyframes streamingDot {
          0% { opacity: 0.2; }
          50% { opacity: 1; }
          100% { opacity: 0.2; }
        }

        .streaming-indicator {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          backgroundColor: #3b82f6;
          margin-left: 4px;
          animation: streamingDot 1s infinite;
        }
      `}} />

      <header 
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#fff',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isProcessing ? '#fbbf24' : '#10b981', boxShadow: isProcessing ? '0 0 8px #fbbf24' : 'none' }}></div>
            <span style={{ fontWeight: 600, fontSize: '15px', color: '#111827', letterSpacing: '-0.02em' }}>PageFind Agent</span>
        </div>
        <button 
            onClick={() => setIsCollapsed(true)}
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                color: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
            aria-label="Collapse sidebar"
        >
            <ChevronRight />
        </button>
      </header>

      <div 
        ref={sidebarContentRef}
        onScroll={handleScroll}
        className="agent-scrollbar"
        style={{
          flex: 1,
          padding: '12px 16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          scrollBehavior: 'smooth',
        }}
      >
        <div className="message-list-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '16px', color: '#9ca3af', opacity: 0.6 }}>
             <div style={{ transform: 'scale(1.2)' }}><BotIcon /></div>
             <p style={{ fontSize: '14px', maxWidth: '240px', lineHeight: 1.6 }}>I can execute bash commands and explore your site's content. How can I assist you?</p>
          </div>
        )}
        
        {(() => {
          // Group messages by turn
          const turns: { user: Message; responses: Message[] }[] = [];
          messages.forEach(m => {
            if (m.role === 'user') {
              turns.push({ user: m, responses: [] });
            } else {
              const lastTurn = turns[turns.length - 1];
              if (lastTurn) {
                lastTurn.responses.push(m);
              }
            }
          });

          return turns.map((turn, turnIdx) => {
            const isLastTurn = turnIdx === turns.length - 1;
            const isFinished = !isProcessing || !isLastTurn;
            
            // Calculate total thinking time for the turn
            const totalThinkingTime = turn.responses.reduce((sum, m) => sum + (m.thinkingTime || 0), 0);
            
            // Separate work items from final content
            const hasWork = totalThinkingTime > 0 || turn.responses.some(m => m.tool_calls) || (isLastTurn && isProcessing);
            const turnId = turn.user.turnId || `turn-${turnIdx}`;
            const workIsOpen = !collapsedTurnIds.includes(turnId);

            return (
              <React.Fragment key={`turn-${turnIdx}`}>
                <div className="user-bubble">
                  <MarkdownOutput content={turn.user.content || ''} className="user-markdown" />
                </div>

                {turn.responses.length > 0 && (
                  <div className="assistant-turn-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {hasWork && (
                      <Collapsible 
                        isOpen={workIsOpen}
                        title={
                          <>
                            Worked for {isLastTurn && isProcessing && turnStartTime ? <LiveTimer startTime={turnStartTime} /> : `${(turn.user as any).turnDuration || totalThinkingTime}s`}
                          </>
                        }
                        onToggle={() => {
                          setCollapsedTurnIds(prev => 
                            prev.includes(turnId) 
                              ? prev.filter(id => id !== turnId) 
                              : [...prev, turnId]
                          );
                        }}
                      >
                        {turn.responses.map((m, mIdx) => {
                          if (m.role === 'assistant') {
                            return (
                              <React.Fragment key={`msg-${mIdx}`}>
                                {m.reasoning_content && (
                                  <Collapsible 
                                    isOpen={!collapsedThoughtIds.includes(m.iterationId || `thought-${mIdx}`)}
                                    title={
                                      <>
                                        Thought {m.thinkingTime ? `for ${m.thinkingTime}s` : ''}
                                        {!isFinished && isLastTurn && mIdx === turn.responses.length - 1 && <span className="streaming-indicator" />}
                                      </>
                                    }
                                    onToggle={() => {
                                      const tId = m.iterationId || `thought-${mIdx}`;
                                      setCollapsedThoughtIds(prev => 
                                        prev.includes(tId) ? prev.filter(id => id !== tId) : [...prev, tId]
                                      );
                                    }}
                                  >
                                    <ThinkingBlock 
                                      content={m.reasoning_content} 
                                      isActive={!isFinished && isLastTurn} 
                                    />
                                  </Collapsible>
                                )}
                                {m.tool_calls?.map((tc, tcIdx) => {
                                  let args: any = {};
                                  try { args = JSON.parse(tc.function.arguments); } catch {}
                                  const toolOutput = turn.responses.find(tm => tm.role === 'tool' && tm.tool_call_id === tc.id);
                                  const commandText = args.command || tc.function.arguments;

                                  return (
                                    <div key={`tool-${tcIdx}`} className="terminal-box" style={{ margin: '0 0 16px 0' }}>
                                      <div className="terminal-header" style={{ padding: '6px 10px' }}>
                                        <span style={{ fontWeight: 500, fontSize: '11px' }}>Bash Command</span>
                                      </div>
                                      <div className="terminal-content" style={{ padding: '10px' }}>
                                        <div className="terminal-command-line" style={{ fontSize: '11px' }}>
                                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flex: 1, opacity: 0.9 }}>
                                            <span className="breadcrumb" style={{ fontSize: '10px' }}>$</span>
                                            <span style={{ fontWeight: 500, color: '#f4f4f5' }}>{commandText}</span>
                                          </div>
                                        </div>
                                        {toolOutput ? (
                                          <div style={{ color: '#d1d5db', whiteSpace: 'pre-wrap', marginTop: '8px', fontSize: '11px', lineHeight: 1.4, opacity: 0.9 }}>
                                            {toolOutput.content}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}
                              </React.Fragment>
                            );
                          }
                          return null;
                        })}
                      </Collapsible>
                    )}

                    {/* Final Assistant Content */}
                    {turn.responses.map((m, mIdx) => {
                      if (m.role === 'assistant' && m.content) {
                        return <MarkdownOutput key={`content-${mIdx}`} content={m.content} />;
                      }
                      return null;
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          });
        })()}

        {isProcessing && !messages.some(m => m.role === 'assistant' && (m.content || m.tool_calls)) && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#71717a', padding: '0 4px', animation: 'agentFadeIn 0.5s' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#3b82f6', animation: 'agentPulse 0.8s infinite' }}></div>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#3b82f6', animation: 'agentPulse 0.8s infinite 0.2s' }}></div>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#3b82f6', animation: 'agentPulse 0.8s infinite 0.4s' }}></div>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} style={{ height: '40px' }} />
        </div>
      </div>

      <div style={{ padding: '24px 16px 16px', borderTop: '1px solid #f3f4f6', backgroundColor: '#fff', flexShrink: 0 }}>
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
            placeholder="Ask a question..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(inputValue);
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
                onClick={handleCancel}
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
                 handleSend(inputValue);
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
    </div>
    </>
  );
};
