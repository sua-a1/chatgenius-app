export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  status: 'online' | 'offline' | 'away' | 'busy';
  role: 'user' | 'admin' | 'member';
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  topic: string | null;
  is_private: boolean;
  created_by: string;
  created_at: string;
  updated_at?: string;
  members?: User[];
}

export interface ChannelMembership {
  user_id: string;
  channel_id: string;
  role: 'member' | 'admin';
  joined_at: string;
}

interface Reaction {
  emoji: string;
  users: string[];  // user IDs who reacted
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  reply_to: string | null;
  reply_count: number;
  created_at: string;
  updated_at: string;
  user?: User;
  reactions?: any[];
  attachments?: { url: string; filename: string; }[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  username: string;
  avatar_url: string | null;
}

export interface DirectMessage {
  id: string;
  workspace_id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  file?: {
    name: string;
    url: string;
    type: string;
  };
  reactions?: Reaction[];
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

export interface ThreadMessage extends Message {
  threadDepth?: number;
  reactions?: MessageReaction[];
  attachments?: { url: string; filename: string; }[];
}
  
  