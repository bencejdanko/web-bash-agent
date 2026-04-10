import { Conversation, Message } from '../types';
import { Store } from './Store';
import { AgentState } from './ChatLogic';

export class HistoryLogic {
    private store: Store<AgentState>;

    constructor(store: Store<AgentState>) {
        this.store = store;
    }

    loadHistory() {
        const savedConversations = localStorage.getItem('agent_conversations');
        if (savedConversations) {
            const conversations = JSON.parse(savedConversations);
            this.store.setState({ conversations });
            
            const lastActiveId = localStorage.getItem('agent_active_conversation_id');
            if (lastActiveId && conversations.some((c: Conversation) => c.id === lastActiveId)) {
                const lastConv = conversations.find((c: Conversation) => c.id === lastActiveId);
                this.store.setState({
                    currentConversationId: lastActiveId,
                    messages: lastConv.messages,
                    hasStarted: lastConv.messages.length > 0
                });
            }
        }
    }

    saveCurrentChat(messages: Message[]) {
        const state = this.store.getState();
        if (messages.length === 0 && !state.currentConversationId) return;

        let convId = state.currentConversationId;
        let newConversations = [...state.conversations];
        
        if (!convId) {
            convId = `conv-${Date.now()}`;
            this.store.setState({ currentConversationId: convId });
            localStorage.setItem('agent_active_conversation_id', convId);
        }

        const existingIndex = newConversations.findIndex(c => c.id === convId);
        
        // Prevent infinite loop: check if messages actually changed
        if (existingIndex >= 0) {
            const existingConv = newConversations[existingIndex];
            if (JSON.stringify(existingConv.messages) === JSON.stringify(messages)) {
                return;
            }
        }

        const firstPrompt = messages.find(m => m.role === 'user')?.content || '';
        const title = firstPrompt ? (firstPrompt.slice(0, 40) + (firstPrompt.length > 40 ? '...' : '')) : 'New Chat';

        const conversation: Conversation = {
            id: convId as string,
            title: title,
            messages: messages,
            createdAt: existingIndex >= 0 ? newConversations[existingIndex].createdAt : Date.now(),
            updatedAt: Date.now()
        };

        if (existingIndex >= 0) {
            newConversations[existingIndex] = conversation;
        } else {
            newConversations.push(conversation);
        }

        this.store.setState({ conversations: newConversations });
        localStorage.setItem('agent_conversations', JSON.stringify(newConversations));
    }

    handleNewChat() {
        this.store.setState({
            messages: [],
            currentConversationId: null,
            hasStarted: false
        });
        localStorage.removeItem('agent_active_conversation_id');
    }

    handleSelectConversation(id: string) {
        const state = this.store.getState();
        const conv = state.conversations.find(c => c.id === id);
        if (conv) {
            this.store.setState({
                currentConversationId: id,
                messages: conv.messages,
                hasStarted: conv.messages.length > 0
            });
            localStorage.setItem('agent_active_conversation_id', id);
        }
    }

    handleDeleteConversation(id: string) {
        const state = this.store.getState();
        const newConversations = state.conversations.filter(c => c.id !== id);
        this.store.setState({ conversations: newConversations });
        localStorage.setItem('agent_conversations', JSON.stringify(newConversations));
        
        if (state.currentConversationId === id) {
            this.handleNewChat();
        }
    }
}
