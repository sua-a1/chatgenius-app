export enum QueryType {
  WORKSPACE_INFO = 'workspace_info',
  CHANNEL_CONTEXT = 'channel_context',
  USER_CONTEXT = 'user_context',
  GENERAL_ASSISTANCE = 'general_assistance'
}

export interface MessageContext {
  content: string;
  created_at: string;
  channel_id?: string;
  user_id?: string;
  channel_name?: string;
  username?: string;
  user_full_name?: string;
}

export interface QueryAnalysis {
  type: QueryType;
  entities: {
    channels?: string[];
    users?: string[];
    timeframe?: string;
  };
  contextRequirements?: {
    needsWorkspaceContext: boolean;
    needsChannelContext: boolean;
    needsUserContext: boolean;
    needsTimeContext: boolean;
  };
} 