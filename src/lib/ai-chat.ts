import { AIMessage, AIConversation } from '@/types/ai-chat';

export async function startConversation(workspaceId: string): Promise<string> {
  const response = await fetch('/api/ai/chat/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId }),
  });

  if (!response.ok) {
    throw new Error('Failed to start conversation');
  }

  const data = await response.json();
  return data.conversation_id;
}

export async function sendMessage(
  message: string,
  workspaceId: string,
  conversationId: string
): Promise<AIMessage> {
  const response = await fetch('/api/ai/chat/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      workspaceId,
      conversationId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  const data = await response.json();
  return {
    id: crypto.randomUUID(),
    content: data.message,
    role: 'assistant',
    created_at: new Date().toISOString(),
  };
}

export async function getConversationHistory(
  conversationId: string
): Promise<AIConversation> {
  const response = await fetch(`/api/ai/chat/history?id=${conversationId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch conversation history');
  }

  return response.json();
} 