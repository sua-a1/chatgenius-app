import { QueryType, QueryAnalysis } from './types.ts';

const USER_CONTEXT_PATTERNS = [
  /which channels (have|did) I/i,
  /my (messages|channels)/i,
  /where (have|did) I (send|post|write)/i,
  /what (have|did) I (send|post|write)/i,
  /show me my/i,
  /tell me my/i,
  /check my/i,
  /find my/i,
  /has (sent|written|posted) (messages|message)/i,
  /messages from/i,
  /sent by/i
];

// Add patterns for recent message queries
const RECENT_MESSAGE_PATTERNS = [
  /most recent( message)?/i,
  /latest( message)?/i,
  /last( message)?/i,
  /recent messages?/i
];

export function analyzeQuery(message: string): QueryAnalysis {
  // Extract channel mentions
  const channelMatches = message.match(/channel\s+(?:"|'|#)?([^"'#\n]+)(?:"|')?/gi);
  const channels = channelMatches?.map(match => match.replace(/^channel\s+(?:"|'|#)?|(?:"|')?$/gi, '').trim()) || [];

  // Extract user mentions - now handling full names in quotes and usernames with @
  const userMatches = message.match(/(?:@([a-zA-Z0-9_-]+))|(?:"([^"]+)")|(?:'([^']+)')|(?:user\s+([a-zA-Z0-9_\s-]+))/gi);
  const users = userMatches?.map(match => {
    // Remove @ symbol, 'user' prefix, and quotes
    return match.replace(/^@|^user\s+|"|'/gi, '').trim();
  }) || [];

  // Check if this is a recent message query
  const isRecentMessageQuery = RECENT_MESSAGE_PATTERNS.some(pattern => pattern.test(message));

  // Determine query type
  let type = QueryType.GENERAL_ASSISTANCE;

  // Check for user context patterns first
  if (USER_CONTEXT_PATTERNS.some(pattern => pattern.test(message))) {
    type = QueryType.USER_CONTEXT;
  }
  // Then check other patterns
  else if (/\b(workspace|space)\b/i.test(message)) {
    type = QueryType.WORKSPACE_INFO;
  }
  else if (channels.length > 0) {
    // Only set USER_CONTEXT if explicitly asking about user messages in a channel
    if (users.length > 0 && (
      message.toLowerCase().includes('sent') ||
      message.toLowerCase().includes('written') ||
      message.toLowerCase().includes('posted') ||
      message.toLowerCase().includes('messages from') ||
      message.toLowerCase().includes('messages by')
    )) {
      type = QueryType.USER_CONTEXT;
    } else {
      type = QueryType.CHANNEL_CONTEXT;
    }
  }
  else if (users.length > 0 && !message.toLowerCase().includes('i') && !message.toLowerCase().includes('my')) {
    type = QueryType.USER_CONTEXT;
  }

  return {
    type,
    entities: {
      channels,
      users,
      timeframe: extractTimeframe(message)
    },
    contextRequirements: {
      needsWorkspaceContext: type === QueryType.WORKSPACE_INFO,
      needsChannelContext: type === QueryType.CHANNEL_CONTEXT,
      needsUserContext: type === QueryType.USER_CONTEXT,
      needsTimeContext: !!extractTimeframe(message),
      needsRecentMessages: isRecentMessageQuery
    }
  };
}

function extractTimeframe(message: string): string | undefined {
  const timePatterns = [
    { pattern: /in (?:the )?last (\d+) hours?/i, format: (match: string[]) => `${match[1]} hours` },
    { pattern: /in (?:the )?last (\d+) days?/i, format: (match: string[]) => `${match[1]} days` },
    { pattern: /in (?:the )?last (\d+) weeks?/i, format: (match: string[]) => `${match[1]} weeks` },
    { pattern: /in (?:the )?last (\d+) months?/i, format: (match: string[]) => `${match[1]} months` },
    { pattern: /last (\d+) hours?/i, format: (match: string[]) => `${match[1]} hours` },
    { pattern: /last (\d+) days?/i, format: (match: string[]) => `${match[1]} days` },
    { pattern: /last (\d+) weeks?/i, format: (match: string[]) => `${match[1]} weeks` },
    { pattern: /last (\d+) months?/i, format: (match: string[]) => `${match[1]} months` },
    { pattern: /last (24 hours|hour|day|week|month)/i, format: (match: string[]) => match[1].toLowerCase() },
    { pattern: /(24 hours|today|this week|this month)/i, format: (match: string[]) => match[1].toLowerCase() },
    { pattern: /in the past (24 hours|hour|day|week|month)/i, format: (match: string[]) => match[1].toLowerCase() }
  ];

  for (const { pattern, format } of timePatterns) {
    const match = message.match(pattern);
    if (match) {
      return format(match);
    }
  }

  return undefined;
} 