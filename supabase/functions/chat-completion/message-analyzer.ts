import { QueryType, QueryAnalysis } from './types.ts';

interface EntityPatterns {
  channels: RegExp[];
  users: RegExp[];
  timeframes: RegExp[];
}

const ENTITY_PATTERNS: EntityPatterns = {
  channels: [
    /#([a-zA-Z0-9_-]+)/g,                    // #channel-name
    /channel[s]?\s+([a-zA-Z0-9_-]+)/gi,      // channel name or channels name
    /in\s+([a-zA-Z0-9_-]+)/gi                // in channel-name
  ],
  users: [
    /@([a-zA-Z0-9_-]+)/g,                    // @username
    /user[s]?\s+([a-zA-Z0-9_-]+)/gi,         // user username or users username
    /from\s+([a-zA-Z0-9_-]+)/gi              // from username
  ],
  timeframes: [
    /last\s+(\d+)\s+(day|week|month|year)s?/gi,
    /past\s+(\d+)\s+(day|week|month|year)s?/gi,
    /since\s+(\d{4}-\d{2}-\d{2})/g,
    /between\s+(\d{4}-\d{2}-\d{2})\s+and\s+(\d{4}-\d{2}-\d{2})/g
  ]
};

const QUERY_PATTERNS = {
  workspace: [
    /workspace\s+overview/i,
    /workspace\s+stats/i,
    /workspace\s+activity/i,
    /workspace\s+members/i,
    /workspace\s+channels/i,
    /who\s+is\s+in\s+this\s+workspace/i
  ],
  channel: [
    /channel\s+history/i,
    /channel\s+activity/i,
    /what\s+happened\s+in\s+#/i,
    /messages\s+in\s+#/i,
    /channel\s+topic/i,
    /channel\s+purpose/i
  ],
  user: [
    /user\s+activity/i,
    /user\s+messages/i,
    /what\s+did\s+@/i,
    /messages\s+from\s+@/i,
    /user\s+role/i,
    /user\s+permissions/i
  ]
};

function extractEntities(message: string) {
  const entities = {
    channels: new Set<string>(),
    users: new Set<string>(),
    timeframe: undefined as string | undefined
  };

  // Extract channels
  ENTITY_PATTERNS.channels.forEach(pattern => {
    const matches = message.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) entities.channels.add(match[1].toLowerCase());
    }
  });

  // Extract users
  ENTITY_PATTERNS.users.forEach(pattern => {
    const matches = message.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) entities.users.add(match[1].toLowerCase());
    }
  });

  // Extract timeframe
  ENTITY_PATTERNS.timeframes.forEach(pattern => {
    const match = pattern.exec(message);
    if (match) {
      entities.timeframe = match[0];
    }
  });

  return {
    channels: Array.from(entities.channels),
    users: Array.from(entities.users),
    timeframe: entities.timeframe
  };
}

function determineQueryType(message: string, entities: ReturnType<typeof extractEntities>): QueryType {
  // Check for explicit patterns
  for (const [type, patterns] of Object.entries(QUERY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        switch (type) {
          case 'workspace':
            return QueryType.WORKSPACE_INFO;
          case 'channel':
            return QueryType.CHANNEL_CONTEXT;
          case 'user':
            return QueryType.USER_CONTEXT;
        }
      }
    }
  }

  // If no explicit patterns match, use entity-based heuristics
  if (entities.channels.length > 0) {
    return QueryType.CHANNEL_CONTEXT;
  }
  if (entities.users.length > 0) {
    return QueryType.USER_CONTEXT;
  }
  if (message.toLowerCase().includes('workspace')) {
    return QueryType.WORKSPACE_INFO;
  }

  return QueryType.GENERAL_ASSISTANCE;
}

function analyzeContextRequirements(message: string, queryType: QueryType, entities: ReturnType<typeof extractEntities>) {
  return {
    needsWorkspaceContext: queryType === QueryType.WORKSPACE_INFO || message.toLowerCase().includes('workspace'),
    needsChannelContext: queryType === QueryType.CHANNEL_CONTEXT || entities.channels.length > 0,
    needsUserContext: queryType === QueryType.USER_CONTEXT || entities.users.length > 0,
    needsTimeContext: !!entities.timeframe
  };
}

export function analyzeQuery(message: string): QueryAnalysis {
  const entities = extractEntities(message);
  const type = determineQueryType(message, entities);
  const contextRequirements = analyzeContextRequirements(message, type, entities);

  return {
    type,
    entities,
    contextRequirements
  };
} 