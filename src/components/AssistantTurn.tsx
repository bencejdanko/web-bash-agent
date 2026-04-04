import React from 'react';
import { Message } from '../types';
import { Collapsible } from './Collapsible';
import { LiveTimer } from './LiveTimer';
import { ThinkingBlock } from './ThinkingBlock';
import { TerminalBox } from './TerminalBox';
import { MarkdownOutput } from './MarkdownOutput';

interface AssistantTurnProps {
  responses: Message[];
  isLastTurn: boolean;
  isProcessing: boolean;
  turnStartTime: number | null;
  userTurnDuration?: number;
  workIsOpen: boolean;
  onToggleWork: () => void;
  collapsedThoughtIds: string[];
  onToggleThought: (thoughtId: string) => void;
  bashSandbox?: any;
  sidebarWidth: number;
}

export const AssistantTurn: React.FC<AssistantTurnProps> = ({
  responses,
  isLastTurn,
  isProcessing,
  turnStartTime,
  userTurnDuration,
  workIsOpen,
  onToggleWork,
  collapsedThoughtIds,
  onToggleThought,
  bashSandbox,
  sidebarWidth,
}) => {
  const totalThinkingTime = responses.reduce((sum, m) => sum + (m.thinkingTime || 0), 0);
  const hasWork = totalThinkingTime > 0 || responses.some(m => m.tool_calls) || (isLastTurn && isProcessing);
  const isFinished = !isProcessing || !isLastTurn;

  return (
    <div className="assistant-turn-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {hasWork && (
        <Collapsible 
          isOpen={workIsOpen}
          title={
            <>
              Worked for {isLastTurn && isProcessing && turnStartTime ? <LiveTimer startTime={turnStartTime} /> : `${userTurnDuration || totalThinkingTime}s`}
            </>
          }
          onToggle={onToggleWork}
        >
          {responses.map((m, mIdx) => {
            if (m.role === 'assistant') {
              const tId = m.iterationId || `thought-${mIdx}`;
              return (
                <React.Fragment key={`msg-${mIdx}`}>
                  {m.reasoning_content && (
                    <Collapsible 
                      isOpen={!collapsedThoughtIds.includes(tId)}
                      title={
                        <>
                          Thought {m.thinkingTime ? `for ${m.thinkingTime}s` : (isLastTurn && isProcessing && m.startTime ? <LiveTimer startTime={m.startTime} /> : '')}
                          {!isFinished && isLastTurn && mIdx === responses.length - 1 && <span className="streaming-indicator" />}
                        </>
                      }
                      onToggle={() => onToggleThought(tId)}
                    >
                      <ThinkingBlock 
                        content={m.reasoning_content || ''} 
                        isActive={!isFinished && isLastTurn && mIdx === responses.length - 1} 
                        sidebarWidth={sidebarWidth}
                      />
                    </Collapsible>
                  )}
                  {m.tool_calls?.map((tc, tcIdx) => {
                    let args: any = {};
                    try { args = JSON.parse(tc.function.arguments); } catch {}
                    const toolOutput = responses.find(tm => tm.role === 'tool' && tm.tool_call_id === tc.id && tm.iterationId === m.iterationId);
                    const commandText = args.command || tc.function.arguments;

                    return (
                      <TerminalBox 
                        key={tc.id || `tool-${tcIdx}`}
                        command={commandText}
                        output={toolOutput?.content || undefined}
                        bashSandbox={bashSandbox}
                        isPending={toolOutput?.isPending}
                        startTime={toolOutput?.startTime}
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

      {responses.map((m, mIdx) => {
        if (m.role === 'assistant' && m.content) {
          return <MarkdownOutput key={`content-${mIdx}`} content={m.content} />;
        }
        return null;
      })}
    </div>
  );
};
