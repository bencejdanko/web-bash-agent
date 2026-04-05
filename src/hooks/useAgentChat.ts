import { useState, useRef } from 'react';
import { Message, AgentSidebarProps } from '../types';

export const useAgentChat = (
  props: AgentSidebarProps,
  messages: Message[],
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  hasStarted: boolean,
  setHasStarted: (hasStarted: boolean) => void,
  setIsExpanding: (isExpanding: boolean) => void,
  bashSandbox: any,
  llmBridge: any,
  onFilesystemChange?: (files: Record<string, string>) => void
) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnStartTime, setTurnStartTime] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setTurnStartTime(null);
  };

  const handleSend = async (text: string, setInputValue: (v: string) => void, setCollapsedTurnIds: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (!text.trim() || isProcessing) return;

    if (!hasStarted) {
      setHasStarted(true);
      setIsExpanding(true);
      // Let the width expand state persist for the duration of the CSS transition
      setTimeout(() => {
        setIsExpanding(false);
      }, 800);
    }

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

        const assistantMessage: Message = { 
          role: 'assistant', 
          content: '', 
          reasoning_content: '', 
          turnId, 
          iterationId: iterId,
          startTime: Date.now()
        };
        
        // Add the empty assistant message immediately to show the "Thinking" state
        setMessages(prev => [...prev, assistantMessage]);

        const callStartTime = Date.now();
        let toolCallsAccumulator: any[] = [];

        try {
          const stream = llmBridge.streamChat(currentMessages, { 
            reasoning_effort: props.reasoningEffort || 'low',
            include_thinking: props.includeThinking || true,
            signal: controller.signal
          });

          for await (const chunk of stream) {
            if (controller.signal.aborted) break;
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            let updated = false;
            if (delta.reasoning_content) {
              assistantMessage.reasoning_content = (assistantMessage.reasoning_content || '') + delta.reasoning_content;
              updated = true;
            } else if ((delta as any).reasoning) { 
              assistantMessage.reasoning_content = (assistantMessage.reasoning_content || '') + (delta as any).reasoning;
              updated = true;
            } else if ((delta as any).thought) {
              assistantMessage.reasoning_content = (assistantMessage.reasoning_content || '') + (delta as any).thought;
              updated = true;
            }

            if (delta.content) {
              assistantMessage.content = (assistantMessage.content || '') + delta.content;
              updated = true;
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (!toolCallsAccumulator[tc.index]) {
                  toolCallsAccumulator[tc.index] = { ...tc, function: { ...tc.function } };
                } else {
                  if (tc.id) toolCallsAccumulator[tc.index].id = tc.id;
                  if (tc.function?.name) toolCallsAccumulator[tc.index].function.name = tc.function.name;
                  if (tc.function?.arguments) toolCallsAccumulator[tc.index].function.arguments += tc.function.arguments;
                }
              }
              assistantMessage.tool_calls = toolCallsAccumulator.filter(Boolean);
              updated = true;
            }

            if (updated) {
              setMessages(prev => prev.map(m => 
                m.iterationId === iterId ? { ...assistantMessage } : m
              ));
            }
          }
        } catch (error: any) {
          if (error.name === 'AbortError' || controller.signal.aborted) {
             break;
          }
          throw error;
        }

        if (controller.signal.aborted) break;
        const callEndTime = Date.now();
        assistantMessage.thinkingTime = Math.round((callEndTime - callStartTime) / 1000);
        
        // Final update for this iteration's assistant message with thinking time
        setMessages(prev => prev.map(m => 
          m.iterationId === iterId ? { ...assistantMessage } : m
        ));

        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          const toolResults: Message[] = [];
          
          for (const toolCall of assistantMessage.tool_calls) {
            if (controller.signal.aborted) break;
            if (toolCall.function.name === 'bash') {
              const { command } = JSON.parse(toolCall.function.arguments);
              
              // Add a placeholder tool result so we can show a loader/timer
              const toolResultId = `tool-${Date.now()}`;
              const pendingToolResult: Message = {
                role: 'tool',
                content: '',
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                iterationId: iterId,
                turnId: turnId,
                isPending: true,
                startTime: Date.now()
              };
              setMessages(prev => [...prev, pendingToolResult]);

              const result = await bashSandbox.exec(command);
              
              if (onFilesystemChange) {
                onFilesystemChange(bashSandbox.getFilesystem());
              }

              let output = '';
              if (result.stdout) output += result.stdout;
              if (result.stderr) output += result.stderr;
              if (!output.trim()) output = '(no output)';

              // Update the tool result with actual output
              setMessages(prev => prev.map(m => 
                m.role === 'tool' && m.tool_call_id === toolCall.id && m.iterationId === iterId
                  ? { ...m, content: output, isPending: false }
                  : m
              ));
              
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
          // Sync currentMessages for next iteration
          currentMessages = [...currentMessages, assistantMessage, ...toolResults];
        } else {
          currentMessages = [...currentMessages, assistantMessage];
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

  return { isProcessing, turnStartTime, handleSend, handleCancel };
};
