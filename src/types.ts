export interface Message {
  id: string
  channel_id: string
  user_id: string
  content: string
  reply_to: string | null
  reply_count: number
  created_at: string
  updated_at: string
  user?: {
    id: string
    username: string | null
    avatar_url: string | null
  }
}

export interface Channel {
  id: string
  workspace_id: string
  name: string
  description: string | null
  is_private: boolean
  created_at: string
  updated_at: string
}

export interface MessageReaction {
  message_id: string
  channel_id: string
  user_id: string
  emoji: string
}

export interface ThreadMessageResponse {
  id: string
  channel_id: string
  user_id: string
  content: string
  reply_to: string | null
  reply_count: number
  created_at: string
  updated_at: string
  user_username: string | null
  user_avatar_url: string | null
} 