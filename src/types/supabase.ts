export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          username: string
          avatar_url: string | null
          status: 'online' | 'offline' | 'away' | 'busy'
          role: 'user' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          username: string
          avatar_url?: string | null
          status?: 'online' | 'offline' | 'away' | 'busy'
          role?: 'user' | 'admin'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string
          avatar_url?: string | null
          status?: 'online' | 'offline' | 'away' | 'busy'
          role?: 'user' | 'admin'
          updated_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          owner_id?: string
          updated_at?: string
        }
      }
      workspace_memberships: {
        Row: {
          user_id: string
          workspace_id: string
          role: 'member' | 'admin' | 'owner'
          joined_at: string
        }
        Insert: {
          user_id: string
          workspace_id: string
          role?: 'member' | 'admin' | 'owner'
          joined_at?: string
        }
        Update: {
          role?: 'member' | 'admin' | 'owner'
        }
      }
      channels: {
        Row: {
          id: string
          workspace_id: string
          name: string
          topic: string | null
          is_private: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          topic?: string | null
          is_private?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          topic?: string | null
          is_private?: boolean
          updated_at?: string
        }
      }
      channel_memberships: {
        Row: {
          user_id: string
          channel_id: string
          role: 'member' | 'admin'
          joined_at: string
        }
        Insert: {
          user_id: string
          channel_id: string
          role?: 'member' | 'admin'
          joined_at?: string
        }
        Update: {
          role?: 'member' | 'admin'
        }
      }
      messages: {
        Row: {
          id: string
          user_id: string
          channel_id: string
          content: string
          reply_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          channel_id: string
          content: string
          reply_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          content?: string
          updated_at?: string
        }
      }
      direct_messages: {
        Row: {
          id: string
          workspace_id: string
          sender_id: string
          receiver_id: string
          message: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          sender_id: string
          receiver_id: string
          message: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          message?: string
          updated_at?: string
        }
      }
      files: {
        Row: {
          id: string
          user_id: string
          workspace_id: string
          channel_id: string | null
          file_url: string
          filename: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workspace_id: string
          channel_id?: string | null
          file_url: string
          filename: string
          created_at?: string
        }
        Update: {
          file_url?: string
          filename?: string
        }
      }
    }
  }
} 