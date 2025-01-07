export interface User {
    id: string;
    email: string;
    username: string;
    avatar: string;
    status: 'online' | 'offline' | 'away';
    role: 'member' | 'admin' | 'owner';
    created_at: string;
  }
  
  export interface Workspace {
    id: string;
    name: string;
    owner_id: string;
    created_at: string;
  }
  
  export interface WorkspaceMembership {
    user_id: string;
    workspace_id: string;
    role: 'member' | 'admin' | 'owner';
    joined_at: string;
  }
  
  export interface Channel {
    id: string;
    workspace_id: string;
    name: string;
    topic: string;
    is_private: boolean;
    created_by: string;
    created_at: string;
  }
  
  export interface ChannelMembership {
    user_id: string;
    channel_id: string;
    role: 'member' | 'admin';
    joined_at: string;
  }
  
  export interface Message {
    id: string;
    user_id: string;
    channel_id: string;
    content: string;
    reply_to: string | null;
    created_at: string;
    file?: {
      name: string;
      url: string;
      type: string;
    };
  }
  
  export interface DirectMessage {
    id: string;
    workspace_id: string;
    sender_id: string;
    receiver_id: string;
    message: string;
    created_at: string;
  }
  
  export interface File {
    id: string;
    user_id: string;
    workspace_id: string;
    file_url: string;
    filename: string;
    channel_id: string | null;
    created_at: string;
  }
  
  