export enum QueryType {
  WORKSPACE_INFO = 'workspace_info',
  CHANNEL_CONTEXT = 'channel_context',
  USER_CONTEXT = 'user_context',
  GENERAL_ASSISTANCE = 'general_assistance',
  COUNT_QUERY = 'count_query',
  STATISTICAL_QUERY = 'statistical_query',
  SUMMARY_QUERY = 'summary_query'
}

export interface MessageMetadata {
  channel_id: string;
  user_id: string;
  created_at: string;
  user_email?: string;
  user_avatar_url?: string;
  version?: number;
  is_latest?: boolean;
  is_deleted?: boolean;
  original_message_content?: string;
}

export interface MessageContext {
  content: string;
  created_at: string;
  channel_id?: string;
  channel_name?: string;
  user?: {
    id: string;
    username?: string;
    full_name?: string;
    email?: string;
    avatar_url?: string;
  };
  version?: number;
  is_latest?: boolean;
  is_deleted?: boolean;
}

export interface QueryAnalysis {
  type: QueryType;
  entities: {
    channels?: string[];
    users?: string[];
    timeframe?: string;
    query?: string;
    aggregation?: {
      operation: 'count' | 'average' | 'most' | 'least';
      target: 'messages' | 'reactions' | 'files';
      groupBy?: 'user' | 'channel' | 'time';
    };
  };
  contextRequirements?: {
    needsWorkspaceContext: boolean;
    needsChannelContext: boolean;
    needsUserContext: boolean;
    needsTimeContext: boolean;
    needsRecentMessages: boolean;
    needsAggregation: boolean;
    needsStatistics: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
}

export interface ChatRequest {
  conversation_id: string;
  message: string;
  workspace_id: string;
  channel_id?: string;
  user_id?: string;
  user?: User;
  context?: MessageContext[];
} 