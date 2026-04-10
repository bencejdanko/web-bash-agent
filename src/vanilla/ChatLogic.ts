import { Message, AgentSidebarProps } from '../types';
import { Store } from './Store';

export interface AgentState {
    messages: Message[];
    isProcessing: boolean;
    turnStartTime: number | null;
    hasStarted: boolean;

    collapsedTurnIds: string[];
    collapsedThoughtIds: string[];
    currentModelId: string;
    actualFilesystem: Record<string, string>;
    terminals: { id: string; command?: string; output?: string }[];
    activeTerminalId: string | null;
    activeInfoPanel: 'tools' | 'mcp' | 'system' | null;
    showHistory: boolean;
    isInitializing: boolean;
    conversations: any[];
    currentConversationId: string | null;
    isCollapsed: boolean;
    sidebarSizes: number[];
    skills: any[];
}

export class ChatLogic {
    private store: Store<AgentState>;
    private abortController: AbortController | null = null;
    private props: AgentSidebarProps;
    private bashSandbox: any;
    private llmBridge: any;

    constructor(store: Store<AgentState>, props: AgentSidebarProps) {
        this.store = store;
        this.props = props;
    }

    setDependencies(bashSandbox: any, llmBridge: any) {
        this.bashSandbox = bashSandbox;
        this.llmBridge = llmBridge;
    }

    handleCancel() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.store.setState({ isProcessing: false, turnStartTime: null });
    }

    async handleSend(text: string) {
        const state = this.store.getState();
        if (!text.trim() || state.isProcessing) return;

        if (!state.hasStarted) {
            this.store.setState({ hasStarted: true });
        }

        const turnId = `turn-${Date.now()}`;
        const userMessage: Message = { role: 'user', content: text, turnId };
        
        this.store.setState(s => ({
            messages: [...s.messages, userMessage],
            isProcessing: true,
            turnStartTime: Date.now()
        }));

        const turnStart = Date.now();
        const controller = new AbortController();
        this.abortController = controller;

        try {
            let isWorking = true;
            let iterations = 0;
            let currentMessages = [...this.store.getState().messages];
            
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
                
                this.store.setState(s => ({
                    messages: [...s.messages, assistantMessage]
                }));

                const callStartTime = Date.now();
                let toolCallsAccumulator: any[] = [];
                let hasStartedContent = false;

                try {
                    const stream = this.llmBridge.streamChat(currentMessages, { 
                        reasoning_effort: this.props.reasoningEffort || 'low',
                        include_thinking: this.props.includeThinking ?? true,
                        signal: controller.signal
                    });

                    for await (const chunk of stream) {
                        if (controller.signal.aborted) break;
                        const delta = chunk.choices[0]?.delta;
                        if (!delta) continue;

                        let updated = false;
                        if (delta.reasoning_content || delta.reasoning || delta.thought) {
                            assistantMessage.reasoning_content = (assistantMessage.reasoning_content || '') + (delta.reasoning_content || delta.reasoning || delta.thought);
                            updated = true;
                        }

                        if (delta.content) {
                            if (!hasStartedContent) {
                                hasStartedContent = true;
                                assistantMessage.startTime = Date.now();
                            }
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
                            this.store.setState(s => ({
                                messages: s.messages.map(m => m.iterationId === iterId ? { ...assistantMessage } : m)
                            }));
                        }
                    }
                } catch (error: any) {
                    if (error.name === 'AbortError' || controller.signal.aborted) break;
                    throw error;
                }

                if (controller.signal.aborted) break;
                const callEndTime = Date.now();
                assistantMessage.thinkingTime = Math.round((callEndTime - callStartTime) / 1000);
                
                this.store.setState(s => ({
                    messages: s.messages.map(m => m.iterationId === iterId ? { ...assistantMessage } : m)
                }));

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    const toolResults: Message[] = [];

                    for (const toolCall of assistantMessage.tool_calls) {
                        if (controller.signal.aborted) break;
                        
                        const tool = (this.llmBridge.tools as any[])?.find(t => (t.definition?.function?.name || t.function?.name) === toolCall.function.name);
                        
                        if (tool) {
                            const args = JSON.parse(toolCall.function.arguments);
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
                            this.store.setState(s => ({ messages: [...s.messages, pendingToolResult] }));

                            try {
                                const output = await tool.handler(args, { bashSandbox: this.bashSandbox, llmBridge: this.llmBridge });
                                
                                this.store.setState({ actualFilesystem: this.bashSandbox.getFilesystem() });

                                this.store.setState(s => ({
                                    messages: s.messages.map(m => 
                                        m.role === 'tool' && m.tool_call_id === toolCall.id && m.iterationId === iterId
                                            ? { ...m, content: output || '(no output)', isPending: false }
                                            : m
                                    )
                                }));
                                
                                toolResults.push({
                                    role: 'tool',
                                    content: output || '(no output)',
                                    tool_call_id: toolCall.id,
                                    name: toolCall.function.name,
                                    iterationId: iterId,
                                    turnId: turnId
                                });
                            } catch (e: any) {
                                const errorOutput = `Error executing tool '${toolCall.function.name}': ${e.message || e}`;
                                this.store.setState(s => ({
                                    messages: s.messages.map(m => 
                                        m.role === 'tool' && m.tool_call_id === toolCall.id && m.iterationId === iterId
                                            ? { ...m, content: errorOutput, isPending: false }
                                            : m
                                    )
                                }));
                                toolResults.push({
                                    role: 'tool',
                                    content: errorOutput,
                                    tool_call_id: toolCall.id,
                                    name: toolCall.function.name,
                                    iterationId: iterId,
                                    turnId: turnId
                                });
                            }
                        } else {
                            const errorOutput = `Error: Tool '${toolCall.function.name}' not found.`;
                            const errorResult: Message = {
                                role: 'tool',
                                content: errorOutput,
                                tool_call_id: toolCall.id,
                                name: toolCall.function.name,
                                iterationId: iterId,
                                turnId: turnId
                            };
                            this.store.setState(s => ({ messages: [...s.messages, errorResult] }));
                            toolResults.push(errorResult);
                        }
                    }
                    
                    if (controller.signal.aborted) break;
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
                this.store.setState(s => ({
                    messages: [...s.messages, { role: 'assistant', content: 'Connection error. Check console for details.' }]
                }));
                console.error('Agent error:', error);
            }
        } finally {
            if (this.abortController === controller) {
                this.abortController = null;
            }
            this.store.setState({ isProcessing: false, turnStartTime: null });
            
            const turnEnd = Date.now();
            const finalDuration = Math.round((turnEnd - turnStart) / 1000);
            
            this.store.setState(s => ({
                messages: s.messages.map(m => 
                    m.turnId === turnId && m.role === 'user' 
                        ? { ...m, turnDuration: finalDuration }
                        : m
                ),
                collapsedTurnIds: (turnId && !controller.signal.aborted) ? [...new Set([...s.collapsedTurnIds, turnId])] : s.collapsedTurnIds
            }));
        }
    }
}
