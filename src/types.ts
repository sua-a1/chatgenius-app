export interface Message {
  id: string
  channel_id: string
  user_id: string
  content: string
  reply_to: string | null
  reply_count: number
  created_at: string
  updated_at: string
  attachments?: Array<{
    url: string
    filename: string
  }>
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
  topic: string | null
  is_private: boolean
  created_by: string
  created_at: string
  updated_at?: string
  members?: User[]
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

export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  username: string
  email: string
  avatar: string | null
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'member' | 'admin'
  username: string
  email: string
  avatar_url: string | null
  created_at: string
  updated_at: string
} 