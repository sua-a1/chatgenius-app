import { analyzeQuery } from './message-analyzer.ts';
import { MessageContext, QueryAnalysis, QueryType } from './types.ts';
import { createClient } from './deps.ts';

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function getRelevantMessages(
  workspace_id: string,
  analysis: QueryAnalysis,
  channel_name?: string
): Promise<MessageContext[]> {
  try {
    // Build filter
    const filter: Record<string, any> = {
      workspace_id
    };

    if (channel_name) {
      filter.channel_name = channel_name;
    }

    if (analysis.entities.timeframe) {
      const now = new Date();
      if (analysis.entities.timeframe === 'today') {
        filter.created_at_gte = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        filter.created_at_lte = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      } else if (analysis.entities.timeframe === 'recent') {
        filter.created_at_gte = new Date(now.setHours(now.getHours() - 24)).toISOString();
        filter.created_at_lte = new Date().toISOString();
      }
    }

    if (analysis.entities.users && analysis.entities.users.length > 0) {
      filter.username = analysis.entities.users[0]; // For now, just use the first user
    }

    // Call search_messages function
    const { data: messages, error } = await supabaseClient.rpc('search_messages', {
      query_embedding: [], // Empty embedding for now, we'll rely on filters
      filter,
      match_count: analysis.type === QueryType.CHANNEL_CONTEXT ? 100 : 10
    });

    if (error) {
      console.error('Error searching messages:', error);
      return [];
    }

    return messages.map(msg => ({
      content: msg.content,
      created_at: msg.metadata.created_at,
      channel_id: msg.metadata.channel_id,
      channel_name: msg.metadata.channel_name,
      user: msg.metadata.user ? {
        id: msg.metadata.user.id,
        username: msg.metadata.user.username,
        full_name: msg.metadata.user.full_name,
        email: msg.metadata.user.email,
        avatar_url: msg.metadata.user.avatar_url
      } : undefined,
      metadata: msg.metadata
    }));
  } catch (error) {
    console.error('Error getting relevant messages:', error);
    return [];
  }
}

export async function assembleContext(
  message: string,
  workspace_id: string,
  user_id: string,
  channel_name?: string
): Promise<MessageContext[]> {
  try {
    // Analyze the query to determine context requirements
    const analysis = analyzeQuery(message);
    
    // Get relevant messages based on the query analysis
    const relevantMessages = await getRelevantMessages(
      workspace_id,
      analysis,
      channel_name
    );

    return relevantMessages;
  } catch (error) {
    console.error('Error assembling context:', error);
    return [];
  }
} 