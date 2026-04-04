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
      setIsExpanding(true);
      // Wait for the expand animation before transitioning down
      setTimeout(() => {
        setHasStarted(true);
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

        const callStartTime = Date.now();
        const llmResponse = await llmBridge.chat(currentMessages, { 
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
              const result = await bashSandbox.exec(command);
              
              if (onFilesystemChange) {
                onFilesystemChange(bashSandbox.getFilesystem());
              }

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

  return { isProcessing, turnStartTime, handleSend, handleCancel };
};
