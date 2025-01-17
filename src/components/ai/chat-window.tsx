import React, { useEffect, useRef, useState } from 'react';
import type { ConversationResponse } from '@/types/chat';
import { AIMessageBubble } from './message-bubble';
import { AITypingIndicator } from './typing-indicator';
import { Bot, Trash2, AlertCircle, RefreshCcw, Download } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  error?: boolean;
  retryable?: boolean;
}

interface ErrorState {
  type: 'send' | 'load' | 'delete';
  message: string;
  retryFn?: () => Promise<void>;
}

// Add export function
const exportChatHistory = (messages: Message[], workspaceId: string) => {
  const exportData = {
    workspaceId,
    exportDate: new Date().toISOString(),
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.created_at
    }))
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-history-${workspaceId}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);

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

  // Helper to format dates consistently
  const formatMessageDate = (date: string) => {
    return format(new Date(date), 'MMM d, yyyy h:mm a');
  };

  // Enhanced error handling helper
  const handleError = (type: ErrorState['type'], error: any, retryFn?: () => Promise<void>) => {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    setError({ type, message, retryFn });
    
    if (type === 'send') {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        content: message,
        role: 'assistant',
        created_at: new Date().toISOString(),
        error: true,
        retryable: !!retryFn
      }]);
    }
  };

  // Enhanced message loading with retry
  const loadConversationMessages = async (convId: string, offset = 0) => {
    try {
      setIsLoadingMore(true);
      setError(null);
      console.log('Loading messages:', { convId, offset, workspaceId });
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
      handleError('load', error, () => loadConversationMessages(convId, offset));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!conversationId || !pagination || isLoadingMore || !pagination.hasMore) return;
    
    const nextOffset = pagination.offset + pagination.limit;
    await loadConversationMessages(conversationId, nextOffset);
  };

  // Enhanced message sending with retry
  const handleSendMessage = async (messageText = input) => {
    if (!messageText.trim()) return;

    const tempMessageId = crypto.randomUUID();
    const userMessage: Message = {
      id: tempMessageId,
      content: messageText,
      role: 'user',
      created_at: new Date().toISOString(),
    };

    setInput('');
    setMessages(prev => [...prev, userMessage]);

    try {
      setIsLoading(true);
      setError(null);
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
      handleError('send', error, () => handleSendMessage(messageText));
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced delete with confirmation
  const handleDeleteHistory = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      const response = await fetch(`/api/ai/chat/delete?workspace_id=${workspaceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete chat history');
      }

      setMessages([]);
      setConversationId(null);
      setPagination(null);
      hasLoadedRef.current = false;
      setShowDeleteDialog(false);
    } catch (error) {
      handleError('delete', error, handleDeleteHistory);
    } finally {
      setIsDeleting(false);
    }
  };

  // Fix the handleSendMessage button click handler
  const handleClick = () => {
    handleSendMessage();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex justify-between p-3 border-b dark:border-gray-700">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {messages.length > 0 && (
            <span>Conversation started {formatMessageDate(messages[0].created_at)}</span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => exportChatHistory(messages, workspaceId)}
            disabled={messages.length === 0}
            className="flex items-center px-3 py-2 text-sm text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg transition-colors disabled:opacity-50"
            title="Export chat history"
          >
            <Download className="h-4 w-4 mr-2" />
            <span>Export</span>
          </button>
          <button
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting || messages.length === 0}
            className="flex items-center px-3 py-2 text-sm text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-lg transition-colors disabled:opacity-50"
            title="Delete chat history for current workspace"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {error && error.type !== 'send' && (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {error.message}
            {error.retryFn && (
              <button
                onClick={() => error.retryFn?.()}
                className="flex items-center text-sm font-medium hover:text-red-400"
              >
                <RefreshCcw className="h-4 w-4 mr-1" /> Retry
              </button>
            )}
          </AlertDescription>
        </Alert>
      )}

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
          <div key={message.id} className="space-y-1">
            <AIMessageBubble message={message} />
            {message.error && message.retryable && (
              <button
                onClick={() => handleSendMessage(message.content)}
                className="flex items-center text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
              >
                <RefreshCcw className="h-4 w-4 mr-1" /> Retry sending message
              </button>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400 ml-2">
              {formatMessageDate(message.created_at)}
            </div>
          </div>
        ))}
        {isLoading && <AITypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat History</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all chat history for this workspace? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHistory}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            onClick={handleClick}
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