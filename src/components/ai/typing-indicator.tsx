import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Bot } from 'lucide-react';

export function AITypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 bg-muted/50">
      <Avatar className="mt-4 h-8 w-8">
        <Bot className="h-5 w-5" />
      </Avatar>
      <div className="flex-1 space-y-2 overflow-hidden py-4">
        <div className="flex space-x-2">
          <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
} 