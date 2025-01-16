import { MessageContext, QueryAnalysis } from './types.ts';

interface ScoredContext {
  context: MessageContext;
  score: number;
}

interface ContextAssemblyOptions {
  maxContextItems?: number;
  recencyWeight?: number;
  channelWeight?: number;
  userWeight?: number;
  minScore?: number;
}

const DEFAULT_OPTIONS: Required<ContextAssemblyOptions> = {
  maxContextItems: 10,
  recencyWeight: 0.4,
  channelWeight: 0.3,
  userWeight: 0.3,
  minScore: 0.2
};

function calculateRecencyScore(timestamp: string): number {
  const messageDate = new Date(timestamp);
  const now = new Date();
  const hoursDifference = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);
  
  // Score decreases logarithmically with time
  // 1.0 for messages in the last hour
  // 0.8 for messages in the last day
  // 0.6 for messages in the last week
  // 0.4 for messages in the last month
  // 0.2 for older messages
  if (hoursDifference <= 1) return 1.0;
  if (hoursDifference <= 24) return 0.8;
  if (hoursDifference <= 168) return 0.6;
  if (hoursDifference <= 720) return 0.4;
  return 0.2;
}

function calculateChannelRelevance(
  context: MessageContext,
  queryAnalysis: QueryAnalysis
): number {
  if (!queryAnalysis.entities.channels || queryAnalysis.entities.channels.length === 0) {
    return 0.5; // Neutral score if no channel context
  }

  if (!context.channel_name) {
    return 0.0; // No score if message has no channel
  }

  // Check if the message's channel matches any of the queried channels
  return queryAnalysis.entities.channels.includes(context.channel_name.toLowerCase()) ? 1.0 : 0.2;
}

function calculateUserRelevance(
  context: MessageContext,
  queryAnalysis: QueryAnalysis
): number {
  if (!queryAnalysis.entities.users || queryAnalysis.entities.users.length === 0) {
    return 0.5; // Neutral score if no user context
  }

  if (!context.username) {
    return 0.0; // No score if message has no user
  }

  // Check if the message's user matches any of the queried users
  return queryAnalysis.entities.users.includes(context.username.toLowerCase()) ? 1.0 : 0.2;
}

function scoreContext(
  context: MessageContext,
  queryAnalysis: QueryAnalysis,
  options: Required<ContextAssemblyOptions>
): number {
  const recencyScore = calculateRecencyScore(context.created_at);
  const channelScore = calculateChannelRelevance(context, queryAnalysis);
  const userScore = calculateUserRelevance(context, queryAnalysis);

  return (
    recencyScore * options.recencyWeight +
    channelScore * options.channelWeight +
    userScore * options.userWeight
  );
}

function deduplicateContext(contexts: ScoredContext[]): ScoredContext[] {
  const seen = new Set<string>();
  return contexts.filter(({ context }) => {
    const key = `${context.channel_id}-${context.user_id}-${context.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function assembleContext(
  contexts: MessageContext[],
  queryAnalysis: QueryAnalysis,
  options: ContextAssemblyOptions = {}
): MessageContext[] {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  // Score all contexts
  const scoredContexts: ScoredContext[] = contexts
    .map(context => ({
      context,
      score: scoreContext(context, queryAnalysis, mergedOptions)
    }))
    .filter(({ score }) => score >= mergedOptions.minScore);

  // Sort by score (descending)
  scoredContexts.sort((a, b) => b.score - a.score);

  // Deduplicate
  const dedupedContexts = deduplicateContext(scoredContexts);

  // Take top N
  return dedupedContexts
    .slice(0, mergedOptions.maxContextItems)
    .map(({ context }) => context);
} 