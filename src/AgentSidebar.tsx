import React, { useState, useRef, useEffect } from 'react';
import { TerminalWindow } from './TerminalWindow';
import { BashEngine } from './bashEngine';
import { LlmBridge } from './llmBridge';

// Import CSS
import './styles.css';

export interface Message {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface AgentSidebarProps {
    bashEngine?: any;
    llmBridge?: any;
    apiKey?: string;
    model?: string;
    filesystem?: Record<string, string>;
}

// Icons
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280' }}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

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
  const [terminalState, setTerminalState] = useState<{ command: string; output: string } | null>(null);
  const [isTerminalVisible, setIsTerminalVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use a state-based or effect-based initialization to avoid top-level evaluation issues in some bundlers
  const bashEngineRef = useRef<any>(null);
  const llmBridgeRef = useRef<any>(null);

  if (!bashEngineRef.current) {
    const pf = typeof window !== 'undefined' ? (window as any).pagefind : null;
    bashEngineRef.current = props.bashEngine || new BashEngine(props.filesystem || {}, pf);
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
      
      while (isWorking && iterations < 10) {
        iterations++;
        const llmResponse = await llmBridgeRef.current.chat(currentMessages);
        const assistantMessage = llmResponse.message as Message;
        
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          const toolResults: Message[] = [];
          
          for (const toolCall of assistantMessage.tool_calls) {
            if (toolCall.function.name === 'run_terminal_command') {
              const { command } = JSON.parse(toolCall.function.arguments);
              
              setIsTerminalVisible(true);
              setTerminalState({ command, output: 'Running...' });

              const output = await bashEngineRef.current.run(command);
              setTerminalState({ command, output });

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
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="agent-sidebar-container"
      style={{
        position: 'fixed',
        left: '24px',
        bottom: '24px',
        width: '400px',
        height: 'calc(100vh - 48px)',
        maxHeight: '800px',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9998,
        overflow: 'hidden',
      }}
    >
      <header 
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isProcessing ? '#fbbf24' : '#10b981' }}></div>
            <span style={{ fontWeight: 600, fontSize: '15px', color: '#111827' }}>Agent</span>
            {isProcessing && <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '4px' }}>Thinking...</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setIsTerminalVisible(!isTerminalVisible)}
            style={{ 
              padding: '6px 12px', 
              fontSize: '12px', 
              borderRadius: '6px', 
              border: '1px solid #e5e7eb', 
              backgroundColor: isTerminalVisible ? '#f3f4f6' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 500,
              color: '#374151'
            }}
          >
            <CommandIcon />
            Terminal
          </button>
        </div>
      </header>

      <div 
        className="agent-scrollbar"
        style={{
          flex: 1,
          padding: '24px 20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '16px', color: '#9ca3af', opacity: 0.8 }}>
             <BotIcon />
             <p style={{ fontSize: '14px' }}>Hello! I'm your site assistant.<br />How can I help you today?</p>
          </div>
        )}
        {messages.map((m, i) => (
          m.role !== 'tool' && m.content && (
            <div 
              key={i} 
              className="agent-message"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignSelf: 'stretch',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                {m.role === 'user' ? <UserIcon /> : <BotIcon />}
                <span>{m.role === 'user' ? 'You' : 'Assistant'}</span>
              </div>
              <div 
                style={{
                  padding: m.role === 'user' ? '12px 16px' : '0 4px',
                  borderRadius: m.role === 'user' ? '12px' : '0',
                  backgroundColor: m.role === 'user' ? '#f9fafb' : 'transparent',
                  border: m.role === 'user' ? '1px solid #f3f4f6' : 'none',
                  color: '#111827',
                  lineHeight: '1.6',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.content}
              </div>
            </div>
          )
        ))}
        {isProcessing && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <BotIcon />
            <div style={{ display: 'flex', gap: '4px' }}>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d1d5db', animation: 'fadeIn 1s infinite alternate' }}></div>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d1d5db', animation: 'fadeIn 1s infinite 0.3s alternate' }}></div>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d1d5db', animation: 'fadeIn 1s infinite 0.6s alternate' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '20px', borderTop: '1px solid #f3f4f6' }}>
        <div style={{ position: 'relative' }}>
          <input 
            aria-label="Ask anything about the site..."
            type="text"
            placeholder="Ask anything about the site..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(inputValue)}
            style={{
              width: '100%',
              padding: '12px 48px 12px 16px',
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              color: '#111827',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}
            disabled={isProcessing}
            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
          />
          <button 
            onClick={() => handleSend(inputValue)}
            disabled={isProcessing || !inputValue.trim()}
            style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: inputValue.trim() ? '#3b82f6' : '#f3f4f6',
                color: inputValue.trim() ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: '8px',
                padding: '6px',
                cursor: inputValue.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>

      <TerminalWindow 
        command={terminalState ? terminalState.command : ''} 
        output={terminalState ? terminalState.output : ''} 
        isVisible={isTerminalVisible} 
      />
    </div>
  );
};

