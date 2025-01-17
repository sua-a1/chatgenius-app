import { QueryType, QueryAnalysis } from './types.ts';

const USER_CONTEXT_PATTERNS = [
  // First person patterns for message queries
  /how many.*(?:messages|sent|posted|written).*(?:have|did)\s+I/i,
  /my\s+(?:messages|activity|posts)/i,
  /messages?\s+(?:I|i)\s+(?:have|had)\s+(?:sent|posted|written)/i,
  /(?:have|did)\s+I\s+(?:send|post|write)/i,
  /what\s+(?:have|did)\s+I\s+(?:send|post|write)/i,
  /show\s+(?:me|my)/i,
  /tell\s+me\s+(?:about|what)/i,
  /check\s+my/i,
  /find\s+my/i,
  
  // Third person patterns
  /has\s+(?:sent|written|posted)\s+(?:messages|message)/i,
  /messages\s+from/i,
  /sent\s+by/i
];

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
  /what (have|did) people talk about/i,
  /what.*(?:say|said|talk|think|thought|opinion|stance|view|perspective)/i,
  /how.*(?:feel|felt|think|thought|react|responded)/i
];

const OPINION_PATTERNS = [
  /opinions? (on|about|regarding)/i,
  /thoughts? (on|about|regarding)/i,
  /views? (on|about|regarding)/i,
  /perspective(s)? (on|about|regarding)/i,
  /what.*think about/i,
  /stance(s)? (on|about|regarding)/i,
  /how.*feel about/i,
  /attitude towards?/i
];

const TOPIC_PATTERNS = [
  /\b(?:about|on|regarding|concerning|discussing)\s+([^.,?!]+)/i,
  /\bon\s+the\s+topic\s+of\s+([^.,?!]+)/i,
  /\brelated\s+to\s+([^.,?!]+)/i,
  /\bin\s+relation\s+to\s+([^.,?!]+)/i,
  /\b(?:opinion|thoughts?|views?|perspective|stance)\s+(?:about|on|regarding)\s+([^.,?!]+)/i,
  /\bhow\s+(?:they|users?|people)\s+(?:feel|think|view)\s+(?:about|regarding)\s+([^.,?!]+)/i
];

const TOPIC_QUERY_PATTERNS = [
  /what.*(?:said|talked|discussed|mentioned)\s+about\s+([^.,?!]+)/i,
  /find.*(?:messages|discussions?|mentions?)\s+about\s+([^.,?!]+)/i,
  /search.*(?:for|about)\s+([^.,?!]+)/i,
  /show.*(?:messages|discussions?|mentions?)\s+about\s+([^.,?!]+)/i,
  /tell.*(?:me|us)\s+about\s+([^.,?!]+)/i,
  /any.*(?:messages|discussions?|mentions?)\s+about\s+([^.,?!]+)/i
];

function analyzeAggregation(message: string, currentUsername?: string): QueryAnalysis['entities']['aggregation'] | undefined {
  const hasFirstPerson = /\b(I|me|my|mine)\b/i.test(message);
  const users = hasFirstPerson && currentUsername ? 
    [currentUsername] : 
    extractUsers(message, currentUsername);
  const channels = extractChannels(message).map(cleanChannelName);
  
  // Check for count operations
  if (COUNT_PATTERNS.some(pattern => pattern.test(message))) {
    const target = message.includes('reaction') ? 'reactions' :
                  message.includes('file') ? 'files' : 'messages';
    
    return {
      operation: 'count',
      target,
      groupBy: message.includes('by') ? 'user' : undefined,
      subjects: {
        users: users.length > 0 ? users : undefined,
        channels: channels.map(cleanChannelName),
        topics: extractTopics(message)
      }
    };
  }

  // Check for statistical operations
  if (STATISTICAL_PATTERNS.some(pattern => pattern.test(message))) {
    return {
      operation: message.includes('least') ? 'least' : 'most',
      target: 'messages',
      groupBy: 'user',
      subjects: {
        users: users.length > 0 ? users : undefined,
        channels: channels.map(cleanChannelName),
        topics: extractTopics(message)
      }
    };
  }

  return undefined;
}

function extractUsers(message: string, currentUsername?: string): string[] {
  const users = new Set<string>();

  // Check for first-person references first
  const hasFirstPerson = /\b(I|me|my|mine)\b/i.test(message);
  if (hasFirstPerson && currentUsername) {
    users.add(currentUsername);
    return Array.from(users);
  }

  // Match @mentions with optional punctuation after
  const userMentionPattern = /@([a-zA-Z0-9_-]+)(?:[.,!?;:]|\s|$)/gi;
  
  // Match quoted names with optional punctuation after
  const quotedNamePattern = /"([^"]+)"(?:[.,!?;:]|\s|$)|'([^']+)'(?:[.,!?;:]|\s|$)/gi;
  
  // Match "user name" pattern with optional punctuation after
  const userPrefixPattern = /user\s+([a-zA-Z0-9_\s-]+)(?:[.,!?;:]|\s|$)/gi;

  // Extract @mentions
  const mentionMatches = message.matchAll(userMentionPattern);
  for (const match of mentionMatches) {
    if (match[1]) {
      users.add(match[1].trim());
    }
  }

  // Extract quoted names
  const quotedMatches = message.matchAll(quotedNamePattern);
  for (const match of quotedMatches) {
    const name = match[1] || match[2];
    if (name) {
      users.add(name.trim());
    }
  }

  // Extract user prefix names
  const prefixMatches = message.matchAll(userPrefixPattern);
  for (const match of prefixMatches) {
    if (match[1]) {
      users.add(match[1].trim());
    }
  }

  return Array.from(users);
}

export function cleanChannelName(name: string): string {
  if (!name) return '';
  
  let cleaned = name
    .trim()  // Remove leading/trailing whitespace first
    .replace(/^(?:channel\s+|#+)/, '')  // Remove 'channel' prefix and leading #
    .replace(/[.,!?;:]$/, '')  // Remove trailing punctuation
    .replace(/\s+/g, ' ')  // Normalize multiple spaces to single space
    .replace(/^(?:in|the)\s+/i, '')  // Remove leading "in" or "the"
    .replace(/^(?:to|from)\s+/i, '');  // Remove leading "to" or "from"

  // Special handling for names ending in a number with whitespace
  const numberMatch = cleaned.match(/^(.+?)\s+(\d+)$/);
  if (numberMatch) {
    return `${numberMatch[1]} ${numberMatch[2]}`; // Preserve the space before number
  }

  return cleaned;
}

function isValidChannelName(name: string): boolean {
  // Ignore common words that might be mistakenly extracted
  const commonWords = /^(?:and|or|in|by|from|to|with|the|a|an|how|many|messages?|did|send|channel)$/i;
  
  // Allow channel names with:
  // 1. Start with a letter
  // 2. Can contain letters, numbers
  // 3. Can end with space + number
  // 4. Can have multiple words separated by spaces
  const validFormat = /^[A-Za-z][A-Za-z0-9]*(?:\s+(?:[A-Za-z][A-Za-z0-9]*|\d+))*$/;
  
  return name.length > 0 && !commonWords.test(name) && validFormat.test(name);
}

function extractChannels(message: string): string[] {
  // Match channel names with optional punctuation after
  const channelPatterns = [
    // Match "channel name" with optional punctuation - allow spaces and numbers
    /(?:^|\s)channel\s+(?:"|'|#)?([A-Za-z][A-Za-z0-9]*(?:\s+\d+)?)\b/gi,
    
    // Match #channel-name with optional punctuation - allow spaces and numbers
    /(?:^|\s)#([A-Za-z][A-Za-z0-9]*(?:\s+\d+)?)\b/gi,
    
    // Match quoted channel names with optional punctuation
    /(?:^|\s)channel\s+"([A-Za-z][A-Za-z0-9]*(?:\s+\d+)?)"(?:[.,!?;:]|\s|$)/gi,
    /(?:^|\s)channel\s+'([A-Za-z][A-Za-z0-9]*(?:\s+\d+)?)'(?:[.,!?;:]|\s|$)/gi,
    
    // Match "in channel X" pattern - allow spaces and numbers
    /\bin\s+(?:channel\s+)?(?:"|'|#)?([A-Za-z][A-Za-z0-9]*(?:\s+\d+)?)\b/gi,
    
    // Match "from channel X" pattern - allow spaces and numbers
    /\bfrom\s+(?:channel\s+)?(?:"|'|#)?([A-Za-z][A-Za-z0-9]*(?:\s+\d+)?)\b/gi,
    
    // Match "to channel X" pattern - allow spaces and numbers
    /\bto\s+(?:channel\s+)?(?:"|'|#)?([A-Za-z][A-Za-z0-9]*(?:\s+\d+)?)\b/gi,
    
    // Match channel names with numbers after space - must start with letter
    /\b([A-Za-z][A-Za-z0-9]*\s+\d+)\b/gi
  ];

  const channels = new Set<string>();

  for (const pattern of channelPatterns) {
    const matches = message.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const channelName = cleanChannelName(match[1]);
        // Additional validation to ensure we don't match common query words
        if (isValidChannelName(channelName) && 
            !/^(how|many|messages?|did|send|channel|in|from|to)$/i.test(channelName)) {
          channels.add(channelName);
        }
      }
    }
  }

  return Array.from(channels);
}

function extractTopics(message: string): string[] {
  const topics = new Set<string>();
  
  // Extract topics in quotes
  const quotedTopics = message.match(/"([^"]+)"|'([^']+)'/g);
  if (quotedTopics) {
    quotedTopics.forEach(t => topics.add(t.replace(/['"]/g, '').trim()));
  }
  
  // Extract topics after common prepositions and opinion indicators
  for (const pattern of TOPIC_PATTERNS) {
    const matches = message.matchAll(new RegExp(pattern, 'gi'));
    for (const match of matches) {
      if (match[1]) {
        const topic = match[1].trim()
          .replace(/^(the|a|an)\s+/i, '')  // Remove articles
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .toLowerCase();  // Normalize case
        
        if (topic.length > 0) {
          topics.add(topic);
        }
      }
    }
  }
  
  // Special case for AI/ML related topics
  if (/\b(ai|artificial intelligence|machine learning|ml)\b/i.test(message)) {
    topics.add('ai');
  }
  
  return Array.from(topics);
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

export function analyzeQuery(message: string, currentUsername?: string): QueryAnalysis {
  const hasFirstPerson = /\b(I|me|my|mine)\b/i.test(message);
  
  // If there's a first-person reference and we have the current username, use it
  const users = hasFirstPerson && currentUsername ? 
    [currentUsername] : 
    extractUsers(message, currentUsername);
    
  const channels = extractChannels(message).map(cleanChannelName);
  const topics = extractTopics(message);
  
  // Determine query type first, before analyzing aggregation
  let type = QueryType.GENERAL_ASSISTANCE;
  
  // Check for explicit count queries first
  if (COUNT_PATTERNS.some(pattern => pattern.test(message))) {
    type = QueryType.COUNT_QUERY;
  }
  // Then check for explicit statistical queries
  else if (STATISTICAL_PATTERNS.some(pattern => pattern.test(message))) {
    type = QueryType.STATISTICAL_QUERY;
  }
  // Then check for explicit summary queries
  else if (SUMMARY_PATTERNS.some(pattern => pattern.test(message))) {
    type = QueryType.SUMMARY_QUERY;
  }
  // Then check for topic queries
  else if (TOPIC_QUERY_PATTERNS.some(pattern => pattern.test(message)) || topics.length > 0) {
    type = QueryType.TOPIC_QUERY;
  }
  // Then check for user context queries
  else if (USER_CONTEXT_PATTERNS.some(pattern => pattern.test(message)) || hasFirstPerson) {
    type = QueryType.USER_CONTEXT;
  }
  // Then check for workspace queries
  else if (/\b(workspace|space)\b/i.test(message)) {
    type = QueryType.WORKSPACE_INFO;
  }
  // Finally, if no other type matches and channels are mentioned, it's a channel context query
  else if (channels.length > 0) {
    type = QueryType.CHANNEL_CONTEXT;
  }

  // Now analyze aggregation based on the determined type
  let queryAggregation = analyzeAggregation(message, currentUsername);

  return {
    type,
    entities: {
      channels: channels.map(cleanChannelName),
      users,
      timeframe: extractTimeframe(message),
      aggregation: queryAggregation,
      topics
    },
    contextRequirements: {
      needsWorkspaceContext: type === QueryType.WORKSPACE_INFO,
      needsChannelContext: (type === QueryType.CHANNEL_CONTEXT || channels.length > 0) ||
                          (type === QueryType.COUNT_QUERY && channels.length > 0) ||
                          type === QueryType.SUMMARY_QUERY,
      needsUserContext: (type === QueryType.USER_CONTEXT || users.length > 0 || hasFirstPerson) ||
                       (type === QueryType.COUNT_QUERY && (users.length > 0 || hasFirstPerson)) ||
                       type === QueryType.SUMMARY_QUERY,
      needsTimeContext: !!extractTimeframe(message),
      needsRecentMessages: RECENT_MESSAGE_PATTERNS.some(pattern => pattern.test(message)),
      needsAggregation: type === QueryType.COUNT_QUERY || 
                       type === QueryType.TOPIC_QUERY ||
                       (users.length > 0 && (type === QueryType.SUMMARY_QUERY || 
                                           type === QueryType.USER_CONTEXT || 
                                           OPINION_PATTERNS.some(pattern => pattern.test(message)))),
      needsStatistics: type === QueryType.STATISTICAL_QUERY,
      needsContentAnalysis: type === QueryType.SUMMARY_QUERY || 
                           type === QueryType.COUNT_QUERY ||
                           type === QueryType.STATISTICAL_QUERY ||
                           type === QueryType.TOPIC_QUERY ||
                           OPINION_PATTERNS.some(pattern => pattern.test(message)),
      needsMessageContext: type === QueryType.SUMMARY_QUERY || 
                          type === QueryType.COUNT_QUERY ||
                          type === QueryType.STATISTICAL_QUERY ||
                          type === QueryType.TOPIC_QUERY
    }
  };
} 