import React from 'react';
import { Message } from '../types';
import { MarkdownOutput } from './MarkdownOutput';
import { AssistantTurn } from './AssistantTurn';
import { ThinkingIndicator } from './ThinkingIndicator';

interface MessageTurnsProps {
  messages: Message[];
  isProcessing: boolean;
  turnStartTime: number | null;
  collapsedTurnIds: string[];
  onToggleTurn: (turnId: string) => void;
  collapsedThoughtIds: string[];
  onToggleThought: (thoughtId: string) => void;
  bashSandbox?: any;
  sidebarWidth: number;
}

export const MessageTurns: React.FC<MessageTurnsProps> = ({
  messages,
  isProcessing,
  turnStartTime,
  collapsedTurnIds,
  onToggleTurn,
  collapsedThoughtIds,
  onToggleThought,
  bashSandbox,
  sidebarWidth,
}) => {
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

  return (
    <>
      {turns.map((turn, turnIdx) => {
        const isLastTurn = turnIdx === turns.length - 1;
        const turnId = turn.user.turnId || `turn-${turnIdx}`;
        const workIsOpen = !collapsedTurnIds.includes(turnId);

        return (
          <React.Fragment key={`turn-${turnIdx}`}>
            <div className="user-bubble">
              <MarkdownOutput content={turn.user.content || ''} />
            </div>

            {turn.responses.length > 0 ? (
              <AssistantTurn 
                responses={turn.responses}
                isLastTurn={isLastTurn}
                isProcessing={isProcessing}
                turnStartTime={turnStartTime}
                userTurnDuration={turn.user.turnDuration}
                workIsOpen={workIsOpen}
                onToggleWork={() => onToggleTurn(turnId)}
                collapsedThoughtIds={collapsedThoughtIds}
                onToggleThought={onToggleThought}
                bashSandbox={bashSandbox}
                sidebarWidth={sidebarWidth}
              />
            ) : (
              isLastTurn && isProcessing && (
                <div style={{ marginLeft: '12px', marginTop: '16px', marginBottom: '16px' }}>
                  <ThinkingIndicator />
                </div>
              )
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};
