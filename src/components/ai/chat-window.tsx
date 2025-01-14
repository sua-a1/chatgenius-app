import React, { useEffect, useRef, useState } from 'react';
import { AIMessage, AIConversationResponse } from '@/types/ai-chat';
import { AIMessageBubble } from './message-bubble';
import { AITypingIndicator } from './typing-indicator';
import { Bot } from 'lucide-react';

interface AIChatWindowProps {
  workspaceId: string;
}

export function AIChatWindow({ workspaceId }: AIChatWindowProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
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
      console.log('Conversation started:', data);
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
    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      content: messageText,
      role: 'user',
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        currentConversationId = await startNewConversation();
        setConversationId(currentConversationId);
      }

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

      const data: AIConversationResponse = await response.json();
      
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        content: data.response,
        role: 'assistant',
        created_at: new Date().toISOString(),
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
      // Add the error to the messages
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        content: error instanceof Error ? error.message : 'An error occurred while sending your message',
        role: 'assistant',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
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

      <div className="p-4 border-t bg-background">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask me anything about your workspace..."
            className="flex-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#3A2E6E]"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading}
            className="px-6 py-3 bg-[#3A2E6E] text-white rounded-lg hover:bg-[#2A2154] focus:outline-none focus:ring-2 focus:ring-[#3A2E6E] disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
} 