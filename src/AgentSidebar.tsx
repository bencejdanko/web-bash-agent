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
const MarkdownOutput: React.FC<{ content: string; className?: string }> = ({ content, className }) => {
  return (
    <div className={`markdown-output ${className || ''}`} style={{ fontSize: '14px', color: '#111827', lineHeight: '1.6' }}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          ul: ({node, ...props}) => <ul style={{ paddingLeft: '20px', marginBottom: '12px' }} {...props} />,
          ol: ({node, ...props}) => <ol style={{ paddingLeft: '20px', marginBottom: '12px' }} {...props} />,
          li: ({node, ...props}) => <li style={{ marginBottom: '4px' }} {...props} />,
          code: ({node, ...props}) => <code style={{ backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '4px', fontSize: '0.9em', fontFamily: 'JetBrains Mono' }} {...props} />,
          strong: ({node, ...props}) => <strong style={{ fontWeight: 600 }} {...props} />,
          p: ({node, ...props}) => <p style={{ marginBottom: '12px' }} {...props} />,
          h1: ({node, ...props}) => <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }} {...props} />,
          h2: ({node, ...props}) => <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }} {...props} />,
          h3: ({node, ...props}) => <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }} {...props} />,
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
 * Custom Collapsible using Pretext for accurate height measurement to enable smooth transitions.
 */
const SmoothCollapsible: React.FC<{ 
  isOpen: boolean; 
  text: string;
  font: string;
  lineHeight: number;
  width: number;
  title: React.ReactNode; 
  onToggle?: () => void;
  className?: string;
  extraPadding?: number;
  render?: (text: string) => React.ReactNode;
}> = ({ isOpen, text, font, lineHeight, width, title, onToggle, className, extraPadding = 16, render }) => {
  const height = useTextHeight(text, font, width, lineHeight, extraPadding);

  return (
    <div className={`smooth-collapsible ${className || ''}`} style={{ marginBottom: '4px' }}>
      <div 
        onClick={onToggle}
        className="collapsible-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          userSelect: 'none',
          padding: '2px 0',
        }}
      >
        <svg 
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" 
          style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)', color: '#9ca3af' }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        {title}
      </div>
      <div 
        style={{ 
          height: isOpen ? `${height}px` : '0px',
          overflow: 'hidden',
          transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div style={{ paddingBottom: '8px', paddingLeft: '12px' }}>
          {render ? render(text) : text}
        </div>
      </div>
    </div>
  );
};

export const AgentSidebar: React.FC<AgentSidebarProps> = (props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeIterationId, setActiveIterationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMessage: Message = { role: 'user', content: text };
    let currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setInputValue('');
    setIsProcessing(true);

    try {
      let isWorking = true;
      let iterations = 0;
      
      while (isWorking && iterations < 15) {
        iterations++;
        const iterId = `iter-${Date.now()}-${iterations}`;
        setActiveIterationId(iterId);

        const callStartTime = Date.now();
        const llmResponse = await llmBridgeRef.current.chat(currentMessages, { 
          reasoning_effort: props.reasoningEffort || 'low',
          include_thinking: props.includeThinking || true
        });
        const callEndTime = Date.now();
        
        const assistantMessage = llmResponse.message as Message;
        assistantMessage.iterationId = iterId;
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
                iterationId: iterId
              });
            }
          }
          
          currentMessages = [...currentMessages, assistantMessage, ...toolResults];
          setMessages(currentMessages);
        } else {
          currentMessages = [...currentMessages, assistantMessage];
          setMessages(currentMessages);
          isWorking = false;
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Check console for details.' }]);
      console.error('Agent error:', error);
    } finally {
      setIsProcessing(false);
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
        aria-label="Open Agentic Assistant"
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

        .assistant-reasoning {
          border-left: none;
          margin: 4px 0;
          border-radius: 0;
        }

        .reasoning-header {
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          letter-spacing: normal;
          text-transform: none;
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
            <span style={{ fontWeight: 600, fontSize: '15px', color: '#111827', letterSpacing: '-0.02em' }}>Agentic Assistant</span>
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
        className="agent-scrollbar"
        style={{
          flex: 1,
          padding: '20px 16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          scrollBehavior: 'smooth',
        }}
      >
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '16px', color: '#9ca3af', opacity: 0.6 }}>
             <div style={{ transform: 'scale(1.2)' }}><BotIcon /></div>
             <p style={{ fontSize: '14px', maxWidth: '240px', lineHeight: 1.6 }}>I can execute bash commands and explore your site's content. How can I assist you?</p>
          </div>
        )}
        
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={`user-${i}`} className="user-bubble">
                <MarkdownOutput content={m.content || ''} className="user-markdown" />
              </div>
            );
          }

          if (m.role === 'assistant') {
            const reasoning = m.reasoning_content || '';
            const content = m.content || '';
            const isOpen = !m.iterationId || m.iterationId === activeIterationId;
            const thinkingTime = m.thinkingTime || 0;

            return (
              <div key={`assistant-${i}`} className="assistant-message-container">
                {reasoning && (
                  <SmoothCollapsible 
                    isOpen={isOpen}
                    text={reasoning}
                    font="13.5px Inter"
                    lineHeight={20.25}
                    width={sidebarWidth - 32}
                    onToggle={() => setActiveIterationId(prev => prev === m.iterationId ? null : m.iterationId || null)}
                    title={
                      <div className="reasoning-header">
                        Thought for {thinkingTime}s
                      </div>
                    }
                    className="assistant-reasoning"
                    render={(txt) => <MarkdownOutput content={txt} className="reasoning-markdown" />}
                  />
                )}
                
                {content && (
                  <MarkdownOutput content={content} />
                )}

                {m.tool_calls?.map((tc, idx) => {
                  let args: any = {};
                  try { args = JSON.parse(tc.function.arguments); } catch {}
                  const toolOutput = messages.find(tm => tm.role === 'tool' && tm.tool_call_id === tc.id);
                  const commandText = args.command || tc.function.arguments;

                  return (
                    <div key={`tool-${idx}`} className="terminal-box">
                      <div className="terminal-header">
                        <span style={{ fontWeight: 500 }}>Ran background command</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: 0.8 }} className="hover-brighten">
                          <span style={{ fontSize: '11px' }}>Relocate</span>
                          <RelocateIcon />
                        </div>
                      </div>
                      <div className="terminal-content">
                        <div className="terminal-command-line">
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flex: 1, opacity: 0.9 }}>
                            <span className="breadcrumb">pagefind-bash-agent-astro &gt;</span>
                            <span style={{ fontWeight: 500, color: '#f4f4f5' }}>{commandText}</span>
                          </div>
                          <button 
                            onClick={() => navigator.clipboard.writeText(commandText)}
                            style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: '2px', transition: 'color 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#e4e4e7'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#71717a'}
                            title="Copy command"
                          >
                            <CopyIcon />
                          </button>
                        </div>
                        {toolOutput ? (
                          <div style={{ color: '#d1d5db', whiteSpace: 'pre-wrap', marginTop: '12px', fontSize: '12px', lineHeight: 1.6 }}>
                            {toolOutput.content}
                          </div>
                        ) : isProcessing ? (
                          <div style={{ color: '#52525b', animation: 'agentPulse 1.5s infinite', marginTop: '12px', fontSize: '12px' }}>
                            running...
                          </div>
                        ) : null}
                      </div>
                      <div className="terminal-footer">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} className="hover-brighten">
                           <span>Always run</span>
                           <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                        <span style={{ fontWeight: 500 }}>Exit code 0</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }
          return null;
        })}

        {isProcessing && !messages.some(m => m.role === 'assistant' && (m.content || m.tool_calls)) && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#9ca3af', padding: '0 4px', animation: 'agentFadeIn 0.5s' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#3b82f6', animation: 'agentPulse 0.8s infinite' }}></div>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#3b82f6', animation: 'agentPulse 0.8s infinite 0.2s' }}></div>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#3b82f6', animation: 'agentPulse 0.8s infinite 0.4s' }}></div>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '16px', borderTop: '1px solid #f3f4f6', backgroundColor: '#fff' }}>
        <div style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
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
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fff',
                color: '#111827',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s, height 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                resize: 'none',
                minHeight: '40px',
                height: `${useTextHeight(inputValue || ' ', '14px Inter', sidebarWidth - 60, 21, 20)}px`,
                maxHeight: '200px',
                lineHeight: '1.5',
                fontFamily: 'inherit',
                overflowY: 'auto',
              }}
              disabled={isProcessing}
            />
          </div>
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
                borderRadius: '10px',
                width: '40px',
                height: '40px',
                cursor: inputValue.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                flexShrink: 0,
                transform: inputValue.trim() ? 'scale(1)' : 'scale(0.95)',
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
    </>
  );
};
