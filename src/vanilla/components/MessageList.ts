import { BaseComponent } from '../BaseComponent';
import { Message, AgentInjection } from '../../types';
import { renderWithHighlights } from '../markdown';
import { Collapsible } from './Collapsible';
import { TerminalBox } from './TerminalBox';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ClipBoardIcon, ThumbsUpIcon, ThumbsDownIcon, CheckIcon } from './Icons';


interface MessageListProps {
    messages: Message[];
    isProcessing: boolean;
    turnStartTime: number | null;
    collapsedTurnIds: string[];
    collapsedThoughtIds: string[];
    onToggleTurn: (id: string) => void;
    onToggleThought: (id: string) => void;
    bashSandbox?: any;
    sidebarWidth: number;
    injections: AgentInjection[];
    filesystem: Record<string, string>;
}

export class MessageList extends BaseComponent<MessageListProps> {
    private terminalBoxCache: Map<string, TerminalBox> = new Map();
    private thinkingIndicator: ThinkingIndicator | null = null;

    protected createRootElement(): HTMLElement {
        const div = document.createElement('div');
        div.className = 'message-list-wrapper agent-scrollbar';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '0';
        div.style.overflowY = 'auto';
        div.style.padding = '0';
        div.style.height = '100%';
        div.style.boxSizing = 'border-box';

        // Add event delegation for copy buttons
        div.addEventListener('click', (e) => {
            const btn = (e.target as HTMLElement).closest('.copy-button') as HTMLElement;
            if (!btn) return;

            const content = (btn as any)._copyContent;
            if (content) {
                navigator.clipboard.writeText(content);
                
                // Visual feedback
                const originalInner = btn.innerHTML;
                btn.innerHTML = CheckIcon(14);
                btn.classList.add('copied');
                
                setTimeout(() => {
                    btn.innerHTML = originalInner;
                    btn.classList.remove('copied');
                }, 2000);
            }
        });

        return div;
    }

    render() {
        // Group messages into turns
        const turns: { id: string, user: Message; responses: Message[] }[] = [];
        this.props.messages.forEach((m, i) => {
            if (m.role === 'user') {
                const id = m.turnId || `turn-${turns.length}`;
                turns.push({ id, user: m, responses: [] });
            } else if (turns.length > 0) {
                turns[turns.length - 1].responses.push(m);
            }
        });

        this.element.innerHTML = '';

        turns.forEach((turn, idx) => {
            const isLastTurn = idx === turns.length - 1;
            const turnDiv = document.createElement('div');
            turnDiv.className = 'chat-turn';
            
            // User message
            const userBubble = document.createElement('div');
            userBubble.className = 'user-bubble agent-scrollbar';
            userBubble.innerHTML = renderWithHighlights(
                turn.user.content || '',
                this.props.injections,
                this.props.filesystem
            );
            
            const userActions = document.createElement('div');
            userActions.className = 'message-actions';
            const userCopyBtn = document.createElement('button');
            userCopyBtn.className = 'action-button copy-button';
            userCopyBtn.title = 'Copy message';
            userCopyBtn.innerHTML = ClipBoardIcon(14);
            (userCopyBtn as any)._copyContent = turn.user.content || '';
            userActions.appendChild(userCopyBtn);
            userBubble.appendChild(userActions);

            turnDiv.appendChild(userBubble);

            // Assistant responses container
            const assistantTurnContainer = document.createElement('div');
            assistantTurnContainer.className = 'assistant-turn-container';
            assistantTurnContainer.style.display = 'flex';
            assistantTurnContainer.style.flexDirection = 'column';
            assistantTurnContainer.style.gap = '8px';
            assistantTurnContainer.style.padding = '0'; 

            // Handle "Work" (Thinking + Tool Calls)
            const totalThinkingTime = turn.responses.reduce((sum, m) => sum + (m.thinkingTime || 0), 0);
            const hasWork = totalThinkingTime > 0 || turn.responses.some(m => m.tool_calls) || (isLastTurn && this.props.isProcessing);
            
            if (hasWork) {
                const workIsOpen = !this.props.collapsedTurnIds.includes(turn.id);
                const workContent = document.createElement('div');
                
                turn.responses.forEach((m, mIdx) => {
                    if (m.role === 'assistant') {
                        const tId = m.iterationId || `thought-${idx}-${mIdx}`;
                        
                        // Reasoning
                        if (m.reasoning_content) {
                            const thoughtIsOpen = !this.props.collapsedThoughtIds.includes(tId);
                            const thoughtCollapsible = new Collapsible({
                                title: `Thought ${m.thinkingTime ? `for ${m.thinkingTime}s` : ''}`,
                                isOpen: thoughtIsOpen,
                                onToggle: () => this.props.onToggleThought(tId),
                                content: `<div class="thinking-block">${m.reasoning_content}</div>`
                            });
                            thoughtCollapsible.render();
                            workContent.appendChild(thoughtCollapsible.getElement());
                        }

                        // Tool Calls
                        m.tool_calls?.forEach((tc, tcIdx) => {
                            let args: any = {};
                            try { args = JSON.parse(tc.function.arguments); } catch {}
                            const toolOutput = turn.responses.find(tm => tm.role === 'tool' && tm.tool_call_id === tc.id && tm.iterationId === m.iterationId);
                            const commandText = args.command || (tc.function.name + ': ' + tc.function.arguments);

                            const terminalId = `${m.iterationId}-${tc.id || tcIdx}`;
                            let termBox = this.terminalBoxCache.get(terminalId);
                            
                            const termProps = {
                                id: terminalId,
                                command: commandText,
                                output: toolOutput?.content || undefined,
                                bashSandbox: this.props.bashSandbox,
                                isPending: toolOutput?.isPending,
                                startTime: toolOutput?.startTime
                            };

                            if (!termBox) {
                                termBox = new TerminalBox(termProps);
                                termBox.init();
                                this.terminalBoxCache.set(terminalId, termBox);
                            } else {
                                termBox.update(termProps);
                            }
                            
                            workContent.appendChild(termBox.getElement());
                        });
                    }
                });

                const workCollapsible = new Collapsible({
                    title: `Worked for ${turn.user.turnDuration || totalThinkingTime}s`,
                    isOpen: workIsOpen,
                    onToggle: () => this.props.onToggleTurn(turn.id),
                    content: workContent
                });
                workCollapsible.render();
                assistantTurnContainer.appendChild(workCollapsible.getElement());
            }

            // Main Assistant Content
            turn.responses.forEach(m => {
                if (m.role === 'assistant' && m.content) {
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'markdown-output';
                    contentDiv.innerHTML = renderWithHighlights(
                        m.content,
                        this.props.injections,
                        this.props.filesystem
                    );
                    assistantTurnContainer.appendChild(contentDiv);

                    // Bot actions
                    const botActions = document.createElement('div');
                    botActions.className = 'bot-actions';
                    
                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'action-button copy-button';
                    copyBtn.title = 'Copy response';
                    copyBtn.innerHTML = ClipBoardIcon(14);
                    (copyBtn as any)._copyContent = m.content;
                    
                    const upBtn = document.createElement('button');
                    upBtn.className = 'action-button thumb-up-button';
                    upBtn.title = 'Thumbs up';
                    upBtn.innerHTML = ThumbsUpIcon(14);
                    
                    const downBtn = document.createElement('button');
                    downBtn.className = 'action-button thumb-down-button';
                    downBtn.title = 'Thumbs down';
                    downBtn.innerHTML = ThumbsDownIcon(14);
                    
                    botActions.appendChild(copyBtn);
                    botActions.appendChild(upBtn);
                    botActions.appendChild(downBtn);
                    
                    assistantTurnContainer.appendChild(botActions);
                }
            });

            // Add thinking indicator to the last turn if processing
            if (isLastTurn && this.props.isProcessing) {
                const latestMessage = this.props.messages[this.props.messages.length - 1];
                const effectiveStartTime = (latestMessage && latestMessage.startTime) ? latestMessage.startTime : this.props.turnStartTime;

                if (!this.thinkingIndicator) {
                    this.thinkingIndicator = new ThinkingIndicator({
                        isProcessing: true,
                        turnStartTime: (effectiveStartTime as number) || Date.now()
                    });
                    this.thinkingIndicator.init();
                } else {
                    this.thinkingIndicator.update({
                        isProcessing: true,
                        turnStartTime: (effectiveStartTime as number) || Date.now()
                    });
                }
                assistantTurnContainer.appendChild(this.thinkingIndicator.getElement());
            }

            turnDiv.appendChild(assistantTurnContainer);
            this.element.appendChild(turnDiv);
        });

        // Clean up thinking indicator if not processing
        if (!this.props.isProcessing && this.thinkingIndicator) {
            this.thinkingIndicator.destroy();
            this.thinkingIndicator = null;
        }

        // Scroll to bottom
        setTimeout(() => {
            const isNearBottom = this.element.scrollHeight - this.element.scrollTop - this.element.clientHeight < 100;
            if (isNearBottom || this.props.isProcessing) {
                this.element.scrollTo({
                    top: this.element.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }, 50);
    }
}
