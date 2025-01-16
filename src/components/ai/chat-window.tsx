import React, { useEffect, useRef, useState } from 'react';
import { Message, ConversationResponse } from '@/types/chat';
import { AIMessageBubble } from './message-bubble';
import { AITypingIndicator } from './typing-indicator';
import { Bot } from 'lucide-react';

interface AIChatWindowProps {
  workspaceId: string;
}

export function AIChatWindow({ workspaceId }: AIChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewConversation = async () => {
    try {
      const response = await fetch('/api/ai/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start conversation');
      }

      const data = await response.json();
      console.log('Started conversation:', data);
      return data.conversation.id;
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    const messageText = input;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: messageText,
      role: 'user',
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      // Ensure we have a conversation ID
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        currentConversationId = await startNewConversation();
        setConversationId(currentConversationId);
      }

      console.log('Sending message with conversation ID:', currentConversationId);
      const response = await fetch('/api/ai/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          workspace_id: workspaceId,
          conversation_id: currentConversationId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      const data = await response.json();
      console.log('Received response:', data);
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        content: data.response,
        role: 'assistant',
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        content: error instanceof Error ? error.message : 'An error occurred while sending your message',
        role: 'assistant',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-8">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Welcome to AI Assistant</p>
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
            placeholder="Ask me anything about your workspace..."
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