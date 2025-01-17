import React, { useEffect, useRef, useState } from 'react';
import { Message, ConversationResponse } from '@/types/chat';
import { AIMessageBubble } from './message-bubble';
import { AITypingIndicator } from './typing-indicator';
import { Bot, Trash2 } from 'lucide-react';

interface AIChatWindowProps {
  workspaceId: string;
}

interface Conversation {
  id: string;
  created_at: string;
  last_message_at: string;
}

interface PaginatedMessages {
  messages: Message[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}

export function AIChatWindow({ workspaceId }: AIChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginatedMessages['pagination'] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentWorkspaceRef = useRef<string>(workspaceId);
  const hasLoadedRef = useRef<boolean>(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle workspace changes and load conversations
  useEffect(() => {
    console.log('Workspace effect triggered:', { 
      workspaceId, 
      currentWorkspace: currentWorkspaceRef.current,
      hasLoaded: hasLoadedRef.current 
    });

    // If workspace hasn't changed and we've already loaded, don't reload
    if (currentWorkspaceRef.current === workspaceId && hasLoadedRef.current) {
      console.log('Workspace unchanged and already loaded, skipping reload');
      return;
    }

    console.log('Loading workspace data');
    // Reset state when workspace changes
    setMessages([]);
    setConversationId(null);
    setPagination(null);
    setIsLoading(false);
    setIsLoadingMore(false);
    currentWorkspaceRef.current = workspaceId;

    const loadWorkspaceConversation = async () => {
      try {
        console.log('Loading conversations for workspace:', workspaceId);
        setIsLoading(true);
        const response = await fetch(`/api/ai/chat/history?workspace_id=${workspaceId}&limit=1`);
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to load conversations');
        }
        
        const data = await response.json();
        console.log('Received conversations:', data);
        const conversations = data.conversations as Conversation[];
        
        if (conversations && conversations.length > 0) {
          const mostRecent = conversations[0];
          console.log('Loading most recent conversation:', mostRecent);
          setConversationId(mostRecent.id);
          await loadConversationMessages(mostRecent.id);
        } else {
          console.log('No conversations found for workspace');
        }
        hasLoadedRef.current = true;
      } catch (error) {
        console.error('Error loading workspace conversation:', error);
        setMessages([{
          id: crypto.randomUUID(),
          content: error instanceof Error ? error.message : 'Failed to load conversation history. You can start a new conversation.',
          role: 'assistant',
          created_at: new Date().toISOString(),
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    if (workspaceId) {
      loadWorkspaceConversation();
    }
  }, [workspaceId]);

  const loadConversationMessages = async (convId: string, offset = 0) => {
    console.log('Loading messages:', { convId, offset, workspaceId });
    try {
      setIsLoadingMore(true);
      const response = await fetch(
        `/api/ai/chat/history?workspace_id=${workspaceId}&conversation_id=${convId}&offset=${offset}&limit=50`
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load messages');
      }
      
      const data = await response.json() as PaginatedMessages;
      console.log('Received messages:', {
        count: data.messages?.length,
        pagination: data.pagination,
        first_message: data.messages?.[0]?.content.substring(0, 50),
        last_message: data.messages?.[data.messages.length - 1]?.content.substring(0, 50)
      });
      
      // Only update if we're still in the same workspace
      if (currentWorkspaceRef.current === workspaceId) {
        if (offset === 0) {
          console.log('Setting initial messages');
          setMessages(data.messages);
        } else {
          console.log('Appending more messages');
          setMessages(prev => [...data.messages, ...prev]);
        }
        setPagination(data.pagination);
      } else {
        console.log('Workspace changed during load, discarding messages');
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      if (currentWorkspaceRef.current === workspaceId) {
        setMessages([{
          id: crypto.randomUUID(),
          content: error instanceof Error ? error.message : 'Failed to load messages. Please try again.',
          role: 'assistant',
          created_at: new Date().toISOString(),
        }]);
      }
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!conversationId || !pagination || isLoadingMore || !pagination.hasMore) return;
    
    const nextOffset = pagination.offset + pagination.limit;
    await loadConversationMessages(conversationId, nextOffset);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const messageText = input;
    setInput('');

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: messageText,
      role: 'user',
      created_at: new Date().toISOString(),
    };

    // Optimistically add user message
    setMessages(prev => [...prev, userMessage]);

    try {
      setIsLoading(true);
      let currentConvId = conversationId;

      if (!currentConvId) {
        // Start new conversation
        const startResponse = await fetch('/api/ai/chat/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId }),
        });

        if (!startResponse.ok) {
          const error = await startResponse.json();
          throw new Error(error.error || 'Failed to start conversation');
        }

        const startData = await startResponse.json();
        currentConvId = startData.conversation.id;
        setConversationId(currentConvId);
      }

      // Send message
      const response = await fetch('/api/ai/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          workspace_id: workspaceId,
          conversation_id: currentConvId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      const data = await response.json();
      
      // Only update if we're still in the same workspace
      if (currentWorkspaceRef.current === workspaceId) {
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          content: data.response,
          role: 'assistant',
          created_at: new Date().toISOString(),
        };

        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (currentWorkspaceRef.current === workspaceId) {
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          content: error instanceof Error ? error.message : 'An error occurred while sending your message',
          role: 'assistant',
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHistory = async () => {
    if (!window.confirm('Are you sure you want to delete all chat history for this workspace? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/ai/chat/delete?workspace_id=${workspaceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete chat history');
      }

      // Reset state
      setMessages([]);
      setConversationId(null);
      setPagination(null);
      hasLoadedRef.current = false;
    } catch (error) {
      console.error('Error deleting chat history:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        content: error instanceof Error ? error.message : 'Failed to delete chat history',
        role: 'assistant',
        created_at: new Date().toISOString(),
      };
      setMessages([errorMessage]);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex justify-end p-3 border-b dark:border-gray-700">
        <button
          onClick={handleDeleteHistory}
          disabled={isDeleting}
          className="flex items-center px-3 py-2 text-sm text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-lg transition-colors disabled:opacity-50"
          title="Delete chat history for current workspace"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          <span>Delete Workspace Chat History</span>
        </button>
      </div>

      {pagination?.hasMore && !isLoadingMore && (
        <button
          onClick={loadMoreMessages}
          className="p-2 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Load earlier messages
        </button>
      )}
      {isLoadingMore && (
        <div className="p-2 text-sm text-center text-gray-500">
          Loading earlier messages...
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-8">
            <p className="text-lg font-medium">Welcome! How can I help you?</p>
            <p className="text-sm">Ask me anything about your workspace and I'll help you find the information you need.</p>
          </div>
        )}
        {messages.map((message) => (
          <AIMessageBubble key={message.id} message={message} />
        ))}
        {isLoading && <AITypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t dark:border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={messages.length > 0 ? "How can I help you?" : "Ask me anything about your workspace..."}
            className="flex-1 px-4 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
} 