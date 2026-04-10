import { BaseComponent } from '../BaseComponent';
import { Message } from '../../types';
import { renderMarkdown } from '../markdown';
import { Collapsible } from './Collapsible';
import { TerminalBox } from './TerminalBox';
import { ThinkingIndicator } from './ThinkingIndicator';


interface MessageListProps {
    messages: Message[];
    isProcessing: boolean;
    turnStartTime: number | null;
    collapsedTurnIds: string[];
    collapsedThoughtIds: string[];
    onToggleTurn: (id: string) => void;
    onToggleThought: (id: string) => void;
    onOpenInTerminal: (cmd?: string, out?: string) => void;
    bashSandbox?: any;
    sidebarWidth: number;
}

export class MessageList extends BaseComponent<MessageListProps> {
    private turnComponents: Map<string, HTMLElement> = new Map();
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

        // Simplified rendering: just rebuild for now to ensure consistency
        this.element.innerHTML = '';

        turns.forEach((turn, idx) => {
            const isLastTurn = idx === turns.length - 1;
            const turnDiv = document.createElement('div');
            turnDiv.className = 'chat-turn';
            
            // User message
            const userBubble = document.createElement('div');
            userBubble.className = 'user-bubble';
            userBubble.innerHTML = renderMarkdown(turn.user.content || '');
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
                            const commandText = args.command || tc.function.arguments;

                            const termBox = new TerminalBox({
                                command: commandText,
                                output: toolOutput?.content || undefined,
                                bashSandbox: this.props.bashSandbox,
                                isPending: toolOutput?.isPending,
                                startTime: toolOutput?.startTime,
                                onOpenExternal: () => this.props.onOpenInTerminal(commandText, toolOutput?.content || undefined)
                            });
                            termBox.init();
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
                    contentDiv.innerHTML = renderMarkdown(m.content);
                    assistantTurnContainer.appendChild(contentDiv);
                }
            });

            // Add thinking indicator to the last turn if processing
            if (isLastTurn && this.props.isProcessing) {
                const latestMessage = this.props.messages[this.props.messages.length - 1];
                const effectiveStartTime = (latestMessage && latestMessage.startTime) ? latestMessage.startTime : this.props.turnStartTime;

                if (!this.thinkingIndicator) {
                    this.thinkingIndicator = new ThinkingIndicator({
                        isProcessing: true,
                        turnStartTime: effectiveStartTime
                    });
                    this.thinkingIndicator.init();
                } else {
                    this.thinkingIndicator.update({
                        isProcessing: true,
                        turnStartTime: effectiveStartTime
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
        // Scroll to bottom with a slight delay
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
