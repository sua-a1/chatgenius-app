import { Message, MessageReaction } from '@/types';

export interface ThreadMessage extends Message {
  threadDepth?: number;
  reactions?: MessageReaction[];
  attachments?: { url: string; filename: string; }[];
} 