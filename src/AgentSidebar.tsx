import React, { useState, useRef, useEffect } from 'react';
import { BashSandbox } from './bashSandbox';
import { LlmBridge } from './llmBridge';

export interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface AgentSidebarProps {
    bashSandbox?: any;
    llmBridge?: any;
    apiKey?: string;
    model?: string;
    filesystem?: Record<string, string>;
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

export const AgentSidebar: React.FC<AgentSidebarProps> = (props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        const llmResponse = await llmBridgeRef.current.chat(currentMessages);
        const assistantMessage = llmResponse.message as Message;
        
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          const toolResults: Message[] = [];
          
          for (const toolCall of assistantMessage.tool_calls) {
            if (toolCall.function.name === 'bash') {
              const { command } = JSON.parse(toolCall.function.arguments);
              
              const result = await bashSandboxRef.current.exec(command);
              
              // Combine stdout and stderr for display, noting errors
              let output = '';
              if (result.stdout) output += result.stdout;
              if (result.stderr) output += result.stderr;
              if (!output.trim()) output = '(no output)';

              toolResults.push({
                role: 'tool',
                content: output,
                tool_call_id: toolCall.id,
                name: toolCall.function.name
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
    <div 
      className="agent-sidebar-container"
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        width: '420px',
        height: 'calc(100vh - 48px)',
        maxHeight: '900px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9998,
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
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
          background: #111827;
          border-radius: 8px;
          padding: 0;
          overflow: hidden;
          margin: 8px 0;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .terminal-header-inline {
          background: #1f2937;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: #9ca3af;
          border-bottom: 1px solid #374151;
        }

        .terminal-content {
          padding: 12px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #e5e7eb;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 300px;
          overflow-y: auto;
        }

        .terminal-command {
          color: #34d399;
          margin-bottom: 8px;
          display: flex;
          gap: 6px;
        }

        .user-bubble {
          background: #f3f4f6;
          padding: 10px 14px;
          border-radius: 12px 12px 2px 12px;
          color: #111827;
          font-size: 14px;
          align-self: flex-end;
          max-width: 85%;
          line-height: 1.5;
          margin-left: auto;
        }

        .assistant-message-container {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-width: 100%;
        }

        .assistant-text {
          padding: 4px;
          font-size: 14px;
          color: #374151;
          line-height: 1.6;
        }

        @keyframes agentFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes agentPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isProcessing ? '#fbbf24' : '#10b981' }}></div>
            <span style={{ fontWeight: 500, fontSize: '14px', color: '#111827', letterSpacing: '-0.01em' }}>Agentic Assistant</span>
        </div>
      </header>

      <div 
        className="agent-scrollbar"
        style={{
          flex: 1,
          padding: '20px 16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '12px', color: '#9ca3af', opacity: 0.7 }}>
             <BotIcon />
             <p style={{ fontSize: '13px' }}>I can explore the site's content via bash.<br />How can I help you today?</p>
          </div>
        )}
        
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} className="user-bubble">
                {m.content}
              </div>
            );
          }

          if (m.role === 'assistant') {
            return (
              <div key={i} className="assistant-message-container">
                {m.content && (
                  <div className="assistant-text">{m.content}</div>
                )}

                {m.tool_calls?.map((tc, idx) => {
                  let args: any = {};
                  try { args = JSON.parse(tc.function.arguments); } catch {}
                  const toolOutput = messages.find(tm => tm.role === 'tool' && tm.tool_call_id === tc.id);

                  return (
                    <div key={idx} className="terminal-box">
                      <div className="terminal-header-inline">
                        <CommandIcon /> bash
                      </div>
                      <div className="terminal-content">
                        <div className="terminal-command">
                          <span>$</span> {args.command || tc.function.arguments}
                        </div>
                        {toolOutput ? (
                          <div style={{ color: '#d1d5db' }}>
                            {toolOutput.content}
                          </div>
                        ) : isProcessing ? (
                          <div style={{ color: '#6b7280', animation: 'agentPulse 1.5s infinite' }}>
                            running...
                          </div>
                        ) : null}
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#9ca3af', padding: '0 4px' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d1d5db', animation: 'agentPulse 0.8s infinite' }}></div>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d1d5db', animation: 'agentPulse 0.8s infinite 0.2s' }}></div>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d1d5db', animation: 'agentPulse 0.8s infinite 0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '16px', borderTop: '1px solid #f3f4f6' }}>
        <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
          <input 
            aria-label="Message assistant..."
            type="text"
            placeholder="Ask a question..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(inputValue)}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              color: '#111827',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}
            disabled={isProcessing}
          />
          <button 
            onClick={() => handleSend(inputValue)}
            disabled={isProcessing || !inputValue.trim()}
            style={{
                backgroundColor: inputValue.trim() ? '#111827' : '#f3f4f6',
                color: inputValue.trim() ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: '8px',
                width: '38px',
                height: '38px',
                cursor: inputValue.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
};
