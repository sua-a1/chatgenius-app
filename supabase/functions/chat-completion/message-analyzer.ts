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

const COUNT_PATTERNS = [
  /how many/i,
  /number of/i,
  /count of/i,
  /total/i
];

const STATISTICAL_PATTERNS = [
  /most active/i,
  /least active/i,
  /average/i,
  /who (has sent|sent|wrote|posted) the most/i,
  /who (has been|is|was) most active/i
];

const SUMMARY_PATTERNS = [
  /summarize/i,
  /summary of/i,
  /what (has been|was) discussed/i,
  /what (have|did) people talk about/i
];

function analyzeAggregation(message: string): QueryAnalysis['entities']['aggregation'] | undefined {
  // Check for count operations
  if (COUNT_PATTERNS.some(pattern => pattern.test(message))) {
    const target = message.includes('reaction') ? 'reactions' :
                  message.includes('file') ? 'files' : 'messages';
    
    return {
      operation: 'count',
      target,
      groupBy: message.includes('by') ? 'user' : undefined
    };
  }

  // Check for statistical operations
  if (STATISTICAL_PATTERNS.some(pattern => pattern.test(message))) {
    return {
      operation: message.includes('least') ? 'least' : 'most',
      target: 'messages',
      groupBy: 'user'
    };
  }

  return undefined;
}

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

  // Determine query type and aggregation
  let type = QueryType.GENERAL_ASSISTANCE;
  const aggregation = analyzeAggregation(message);

  if (aggregation?.operation === 'count') {
    type = QueryType.COUNT_QUERY;
  } else if (aggregation?.operation === 'most' || aggregation?.operation === 'least') {
    type = QueryType.STATISTICAL_QUERY;
  } else if (SUMMARY_PATTERNS.some(pattern => pattern.test(message))) {
    type = QueryType.SUMMARY_QUERY;
  } else if (USER_CONTEXT_PATTERNS.some(pattern => pattern.test(message))) {
    type = QueryType.USER_CONTEXT;
  } else if (/\b(workspace|space)\b/i.test(message)) {
    type = QueryType.WORKSPACE_INFO;
  } else if (channels.length > 0) {
    type = QueryType.CHANNEL_CONTEXT;
  }

  return {
    type,
    entities: {
      channels,
      users,
      timeframe: extractTimeframe(message),
      aggregation
    },
    contextRequirements: {
      needsWorkspaceContext: type === QueryType.WORKSPACE_INFO,
      needsChannelContext: type === QueryType.CHANNEL_CONTEXT || channels.length > 0,
      needsUserContext: type === QueryType.USER_CONTEXT || users.length > 0,
      needsTimeContext: !!extractTimeframe(message),
      needsRecentMessages: RECENT_MESSAGE_PATTERNS.some(pattern => pattern.test(message)),
      needsAggregation: type === QueryType.COUNT_QUERY,
      needsStatistics: type === QueryType.STATISTICAL_QUERY
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