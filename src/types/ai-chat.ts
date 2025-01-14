export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AIConversation {
  id: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  messages: AIMessage[];
}

export interface AIConversationResponse {
  response: string;
} 