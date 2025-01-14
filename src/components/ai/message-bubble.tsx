import React from 'react';
import { Message } from '@/types/chat';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Bot, User } from 'lucide-react';

interface AIMessageBubbleProps {
  message: Message;
}

export function AIMessageBubble({ message }: AIMessageBubbleProps) {
  const isBot = message.role === 'assistant';

  return (
    <div className={cn(
      'flex items-start gap-3 px-4',
      isBot ? 'bg-muted/50' : 'bg-background'
    )}>
      <Avatar className="mt-4 h-8 w-8">
        {isBot ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
      </Avatar>
      <div className="flex-1 space-y-2 overflow-hidden py-4">
        <div className="prose prose-sm dark:prose-invert break-words">
          {message.content}
        </div>
      </div>
    </div>
  );
} 