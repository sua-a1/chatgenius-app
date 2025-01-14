export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
}

export interface Conversation {
  id: string
  workspace_id: string
  user_id: string
  created_at: string
  messages: Message[]
}

export interface ConversationResponse {
  conversation: Conversation
  message: Message
  response: string
} 