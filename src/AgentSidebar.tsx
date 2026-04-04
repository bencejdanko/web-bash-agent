import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { BashSandbox } from './bashSandbox';
import { LlmBridge } from './llmBridge';
import { Message, AgentSidebarProps } from './types';
import { BotIcon, ChevronRight } from './components/Icons';
import { MarkdownOutput } from './components/MarkdownOutput';
import { ThinkingBlock } from './components/ThinkingBlock';
import { LiveTimer } from './components/LiveTimer';
import { Collapsible } from './components/Collapsible';
import { TerminalBox } from './components/TerminalBox';
import { ChatInput } from './components/ChatInput';
import { Panel, Group, Separator } from 'react-resizable-panels';
import './AgentSidebar.css';

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
      className={`agent-sidebar-layout-container ${isCollapsed ? 'collapsed' : ''}`}
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        left: 0,
        pointerEvents: 'none', // Allow clicking through to underlying content
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
          style={{ pointerEvents: 'auto' }} // Enable resizing
        />

        <Panel 
          defaultSize={500} 
          minSize={320} 
          maxSize={1000}
          className="agent-sidebar-container"
          style={{
            pointerEvents: 'auto', // Re-enable pointer events for sidebar content
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            boxShadow: '-4px 0 15px -3px rgba(0, 0, 0, 0.05)',
          }}
        >

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
        
        {(() => {
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
            const totalThinkingTime = turn.responses.reduce((sum, m) => sum + (m.thinkingTime || 0), 0);
            const hasWork = totalThinkingTime > 0 || turn.responses.some(m => m.tool_calls) || (isLastTurn && isProcessing);
            const turnId = turn.user.turnId || `turn-${turnIdx}`;
            const workIsOpen = !collapsedTurnIds.includes(turnId);

            return (
              <React.Fragment key={`turn-${turnIdx}`}>
                <div className="user-bubble">
                  <MarkdownOutput content={turn.user.content || ''} />
                </div>

                {turn.responses.length > 0 && (
                  <div className="assistant-turn-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {hasWork && (
                      <Collapsible 
                        isOpen={workIsOpen}
                        title={
                          <>
                            Worked for {isLastTurn && isProcessing && turnStartTime ? <LiveTimer startTime={turnStartTime} /> : `${turn.user.turnDuration || totalThinkingTime}s`}
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
                            const tId = m.iterationId || `thought-${mIdx}`;
                            return (
                              <React.Fragment key={`msg-${mIdx}`}>
                                {m.reasoning_content && (
                                  <Collapsible 
                                    isOpen={!collapsedThoughtIds.includes(tId)}
                                    title={
                                      <>
                                        Thought {m.thinkingTime ? `for ${m.thinkingTime}s` : ''}
                                        {!isFinished && isLastTurn && mIdx === turn.responses.length - 1 && <span className="streaming-indicator" />}
                                      </>
                                    }
                                    onToggle={() => {
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
                                    <TerminalBox 
                                      key={`tool-${tcIdx}`}
                                      command={commandText}
                                      output={toolOutput?.content || undefined}
                                    />
                                  );
                                })}
                              </React.Fragment>
                            );
                          }
                          return null;
                        })}
                      </Collapsible>
                    )}

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
