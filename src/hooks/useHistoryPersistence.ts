import { useState, useEffect } from 'react';
import { Conversation, Message } from '../types';

export const useHistoryPersistence = (
  messages: Message[],
  setMessages: (messages: Message[]) => void,
  setHasStarted: (hasStarted: boolean) => void
) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedConversations = localStorage.getItem('agent_conversations');
    if (savedConversations) {
      const parsed = JSON.parse(savedConversations);
      setConversations(parsed);
      
      // If there's a last active conversation, load it
      const lastActiveId = localStorage.getItem('agent_active_conversation_id');
      if (lastActiveId && parsed.some((c: Conversation) => c.id === lastActiveId)) {
        const lastConv = parsed.find((c: Conversation) => c.id === lastActiveId);
        setCurrentConversationId(lastActiveId);
        setMessages(lastConv.messages);
        if (lastConv.messages.length > 0) {
          setHasStarted(true);
        }
      }
    }
  }, []);

  // Save current conversation to history
  useEffect(() => {
    if (messages.length === 0 && !currentConversationId) return;

    let convId = currentConversationId;
    let newConversations = [...conversations];
    
    if (!convId) {
      convId = `conv-${Date.now()}`;
      setCurrentConversationId(convId);
      localStorage.setItem('agent_active_conversation_id', convId);
    }

    const existingIndex = newConversations.findIndex(c => c.id === convId);
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

    setConversations(newConversations);
    localStorage.setItem('agent_conversations', JSON.stringify(newConversations));
  }, [messages, currentConversationId]);

  const handleNewChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
    localStorage.removeItem('agent_active_conversation_id');
    setHasStarted(false);
  };

  const handleSelectConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversationId(id);
      setMessages(conv.messages);
      localStorage.setItem('agent_active_conversation_id', id);
      setHasStarted(conv.messages.length > 0);
    }
  };

  const handleDeleteConversation = (id: string) => {
    const newConversations = conversations.filter(c => c.id !== id);
    setConversations(newConversations);
    localStorage.setItem('agent_conversations', JSON.stringify(newConversations));
    
    if (currentConversationId === id) {
      setMessages([]);
      setCurrentConversationId(null);
      localStorage.removeItem('agent_active_conversation_id');
      setHasStarted(false);
    }
  };

  return {
    conversations,
    currentConversationId,
    handleNewChat,
    handleSelectConversation,
    handleDeleteConversation
  };
};
