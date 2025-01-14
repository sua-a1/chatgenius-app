import React from 'react';
import { AIMessage } from '@/types/ai-chat';
import { cn } from '@/lib/utils';

interface AIMessageBubbleProps {
  message: AIMessage;
}

export function AIMessageBubble({ message }: AIMessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2',
          isUser ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {message.content}
        </div>
        <div className="mt-1 text-xs opacity-70">
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
} 