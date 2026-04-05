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
import { TerminalBox } from './components/TerminalBox';
import { Message, AgentSidebarProps } from './types';
import { useSidebarWidth } from './hooks/useSidebarWidth';
import { useAutoScroll } from './hooks/useAutoScroll';
import { useHistoryPersistence } from './hooks/useHistoryPersistence';
import { useAgentChat } from './hooks/useAgentChat';
import { useAgentInitialization } from './hooks/useAgentInitialization';
import { useEffect } from 'react';
import { XIcon, CubeIcon, HammerIcon, MCPIcon, EllipsisIcon, FileIcon } from './components/Icons';
import { InfoPanel } from './components/InfoPanel';

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
  const [currentModelId, setCurrentModelId] = useState(props.initialModelId || props.models[0]?.id);
  const currentModelConfig = props.models.find(m => m.id === currentModelId) || props.models[0];
  
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [actualFilesystem, setActualFilesystem] = useState<Record<string, string>>({});
  const [terminals, setTerminals] = useState<{ id: string; command?: string; output?: string }[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [activeInfoPanel, setActiveInfoPanel] = useState<'tools' | 'mcp' | 'system' | null>(null);

  // Initialize sandbox and LLM bridge
  const { bashSandbox, llmBridge, skills, isInitializing } = useAgentInitialization(props, currentModelConfig);

  // Sync filesystem whenever sandbox is initialized or props change
  React.useEffect(() => {
    if (bashSandbox) {
        setActualFilesystem(bashSandbox.getFilesystem());
    }
  }, [bashSandbox, props.filesystem]);

  // Use custom hooks for modular logic
  const sidebarWidth = useSidebarWidth(sidebarContentRef);
  const [actualPanelWidth, setActualPanelWidth] = useState(500);

  useEffect(() => {
    if (!panelRef.current) return;
    const observer = new ResizeObserver((entries) => {
        if (entries[0]) {
            setActualPanelWidth(entries[0].contentRect.width);
        }
    });
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [panelRef]);
  
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
    if (!isInitializing) {
        handleOpen();
    }
  }, [isInitializing]);

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

  const openTerminal = (command?: string, output?: string) => {
    const id = Math.random().toString(36).substring(7);
    setTerminals(prev => [...prev, { id, command, output }]);
    setActiveTerminalId(id);
  };

  const closeTerminal = (id: string) => {
    setTerminals(prev => {
        const next = prev.filter(t => t.id !== id);
        if (activeTerminalId === id) {
            setActiveTerminalId(next.length > 0 ? next[next.length - 1].id : null);
        }
        return next;
    });
  };

  if (isInitializing) {
    return (
        <div className="agent-sidebar-loading" style={{
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            width: '400px',
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            borderLeft: '1px solid var(--agent-border-main)'
        }}>
            <div className="loading-spinner">Initializing Agent...</div>
        </div>
    );
  }

  return (
    <>
      <div className="floating-controls-container" style={{
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 9999,
      }}>
        {isCollapsed && (
          <FloatingToggleButton onClick={handleOpen} />
        )}
      </div>
      
      <div className={`agent-sidebar-layout-container ${isCollapsed ? 'collapsed' : ''}`}>
        <Group orientation="horizontal" style={{ height: '100%', width: '100%' }}>            <Panel 
              defaultSize={800} // THE LIBRARY DOES ***NOT USE PERCENTAGES***!!! THESE ARE PIXEL VALUES! OBEY AND UNDERSTAND OR BE DESTROYED
              minSize={200} // THE LIBRARY DOES ***NOT USE PERCENTAGES***!!! THESE ARE PIXEL VALUES! OBEY AND UNDERSTAND OR BE DESTROYED
              style={{ 
                position: 'relative', 
                pointerEvents: 'none',
                overflow: 'hidden'
              }}
            >
              <div 
                className="terminal-shelf-area-wrapper" 
                style={{ 
                  height: '100%', 
                  width: '100%', 
                  paddingBottom: '0px', 
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {terminals.length > 0 && (
                  <Group orientation="vertical" style={{ height: '100%', width: '100%' }}>
                    <Panel defaultSize={700} style={{ pointerEvents: 'none' }} />
                    <Separator className="terminal-resize-handle-v" style={{ pointerEvents: 'auto' }} />
                    <Panel defaultSize={300} minSize={100} className="terminal-shelf-panel" style={{ pointerEvents: 'auto', overflow: 'hidden' }}>
                      <div className="terminal-shelf-minimal" style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: '#ffffff',
                        borderLeft: '1px solid var(--agent-border-main)',
                        borderTop: '1px solid var(--agent-border-main)',
                        position: 'relative',
                        boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
                        overflow: 'hidden'
                      }}>
                        <div className="terminal-shelf-header" style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            padding: '6px 12px',
                            borderBottom: '1px solid var(--agent-border-main)',
                            backgroundColor: '#ffffff',
                            zIndex: 10
                        }}>
                            <button 
                                onClick={() => setTerminals([])}
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'var(--agent-text-dim)',
                                    borderRadius: '4px',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--agent-bg-subtle)'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <XIcon size={16} />
                            </button>
                        </div>
                        <Group orientation="horizontal" style={{ flexGrow: 1, width: '100%' }}>
                          <Panel defaultSize={80} style={{ position: 'relative', overflow: 'hidden' }}>
                              <div className="terminal-active-area" style={{ position: 'absolute', inset: 0 }}>
                                  {terminals.map(t => (
                                      <div key={t.id} style={{ 
                                          position: 'absolute',
                                          inset: 0,
                                          opacity: activeTerminalId === t.id ? 1 : 0,
                                          pointerEvents: activeTerminalId === t.id ? 'auto' : 'none',
                                          transition: 'opacity 0.2s',
                                          padding: '0'
                                      }}>
                                          <TerminalBox 
                                              command={t.command || 'bash'} 
                                              output={t.output}
                                              bashSandbox={bashSandbox} 
                                              isMinimal={true}
                                          />
                                      </div>
                                  ))}
                              </div>
                          </Panel>
                          
                          <Separator className="terminal-selector-resize-handle" />
                          
                          <Panel defaultSize={20} minSize={10} style={{ backgroundColor: '#ffffff', borderLeft: '1px solid var(--agent-border-main)', overflow: 'hidden' }}>
                              <div className="terminal-selectors" style={{
                                  height: '100%',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  overflowY: 'hidden',
                                  padding: '12px 8px',
                                  gap: '4px',
                                  boxSizing: 'border-box'
                              }}>
                      
                                  {terminals.map(t => (
                                      <div 
                                          key={t.id} 
                                          onClick={() => setActiveTerminalId(t.id)}
                                          className="terminal-selector-item"
                                          style={{
                                              fontSize: '11px',
                                              fontFamily: 'JetBrains Mono',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              color: activeTerminalId === t.id ? '#18181b' : '#71717a',
                                              padding: '4px 6px',
                                              borderRadius: '4px',
                                              backgroundColor: activeTerminalId === t.id ? 'var(--agent-bg-subtle)' : 'transparent',
                                              transition: 'background-color 0.2s',
                                              gap: '8px'
                                          }}
                                      >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                              <CubeIcon />
                                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  term-{t.id}
                                              </span>
                                          </div>
                                          <button 
                                              onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }}
                                              className="terminal-item-close-btn"
                                              style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  cursor: 'pointer',
                                                  padding: '2px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  color: 'inherit',
                                                  opacity: 0.5,
                                                  transition: 'opacity 0.2s'
                                              }}
                                              onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                              onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}
                                          >
                                              <XIcon size={12} />
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          </Panel>
                        </Group>
                      </div>
                    </Panel>
                  </Group>
                )}
              </div>
            </Panel>

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
              <div ref={panelRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <GalaxyBackground />
                <div 
                  className={`agent-panel-inner ${isPadded ? 'padded' : ''}`}
                  style={{ flexGrow: 1, zIndex: 1 }}
                >
                  <SidebarHeader 
                    onCollapse={handleCollapse} 
                    onNewChat={() => { handleNewChat(); setShowHistory(false); setIsExpanding(false); setActiveInfoPanel(null); }}
                    onToggleHistory={() => { setShowHistory(!showHistory); setActiveInfoPanel(null); }}
                    onToggleTools={() => { setActiveInfoPanel(activeInfoPanel === 'tools' ? null : 'tools'); setShowHistory(false); }}
                    onToggleRegistry={() => { setActiveInfoPanel(activeInfoPanel === 'mcp' ? null : 'mcp'); setShowHistory(false); }}
                    onToggleSystem={() => { setActiveInfoPanel(activeInfoPanel === 'system' ? null : 'system'); setShowHistory(false); }}
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

                  {activeInfoPanel === 'tools' && (
                    <InfoPanel title="Agent Tools & Skills" onClose={() => setActiveInfoPanel(null)}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <section>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {llmBridge?.tools.map((tool: any, i: number) => {
                              const def = tool.definition?.function || tool;
                              return (
                                <div 
                                  key={i} 
                                  style={{ 
                                    padding: '12px', 
                                    backgroundColor: 'var(--agent-bg-subtle)', 
                                    borderRadius: '8px', 
                                    border: '1px solid var(--agent-border-main)',
                                    transition: 'all 0.2s ease-out',
                                    cursor: 'default'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--agent-bg-main)';
                                    e.currentTarget.style.boxShadow = 'var(--agent-card-shadow)';
                                    e.currentTarget.style.borderColor = 'var(--agent-border-dark)';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--agent-bg-subtle)';
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.borderColor = 'var(--agent-border-main)';
                                  }}
                                >
                                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--agent-text-main)', marginBottom: '4px', fontFamily: 'JetBrains Mono' }}>
                                    {def.name}
                                  </div>
                                  <div style={{ fontSize: '12px', color: 'var(--agent-text-muted)', lineHeight: '1.5' }}>
                                    {def.description}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      </div>
                    </InfoPanel>
                  )}

                  {activeInfoPanel === 'mcp' && (
                    <InfoPanel title="MCP" onClose={() => setActiveInfoPanel(null)}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ padding: '16px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px dashed var(--agent-border-main)', textAlign: 'center' }}>
                          <MCPIcon size={24} />
                          <div style={{ fontSize: '13px', color: 'var(--agent-text-muted)' }}>
                            Registering dynamic tools and MCP endpoints
                          </div>
                        </div>
                        
                        <section>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                             {(props.customBashCommands || []).filter((c: any) => c.type === 'mcp' || c.type === 'mcp-server').length === 0 ? (
                               <div style={{ fontSize: '12px', color: 'var(--agent-text-muted)', fontStyle: 'italic', padding: '0 8px' }}>
                                 No MCP extensions configured.
                               </div>
                             ) : (
                               (props.customBashCommands || []).map((cmd: any, i: number) => (
                                 <div key={i} style={{ padding: '12px', backgroundColor: 'var(--agent-bg-subtle)', borderRadius: '8px', border: '1px solid var(--agent-border-main)' }}>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                     <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--agent-text-main)', fontFamily: 'JetBrains Mono' }}>{cmd.type}</span>
                                     <span style={{ fontSize: '10px', color: 'var(--agent-accent)', backgroundColor: 'var(--agent-accent-alpha)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Active</span>
                                   </div>
                                   <div style={{ fontSize: '11px', color: 'var(--agent-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                     {cmd.serverUrl || 'Internal Registry'}
                                   </div>
                                 </div>
                               ))
                             )}
                           </div>
                        </section>
                      </div>
                    </InfoPanel>
                  )}

                  {activeInfoPanel === 'system' && (
                    <InfoPanel title="System Information" onClose={() => setActiveInfoPanel(null)}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <section>
                          <div style={{ 
                            padding: '12px', 
                            backgroundColor: '#1e1e1e', 
                            color: '#d4d4d4', 
                            borderRadius: '8px', 
                            fontSize: '11px', 
                            fontFamily: 'JetBrains Mono', 
                            lineHeight: '1.6',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap'
                          }}>
                            {props.systemPrompt}
                          </div>
                        </section>
                      </div>
                    </InfoPanel>
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
                        onOpenInTerminal={openTerminal}
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
                      skills={skills}
                      onOpenTerminal={() => openTerminal()}
                      models={props.models}
                      currentModelId={currentModelId}
                      onModelChange={setCurrentModelId}
                    />

                  </div>
                </div>
              </div>
            </Panel>
          </Group>
        <div className="agent-safe-area-bottom" style={{ height: '80px', width: '100%', pointerEvents: 'none' }} />
      </div>
    </>
  );
};
