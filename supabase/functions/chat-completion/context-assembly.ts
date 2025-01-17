import { analyzeQuery } from './message-analyzer.ts';
import { MessageContext, QueryAnalysis, QueryType } from './types.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { enrichContextWithMetadata } from './index.ts';
import { OpenAI } from './deps.ts';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')!
});

// Initialize Supabase client with auth context
function createSupabaseClient(user_id: string) {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          // Set service role auth
          Authorization: `Bearer ${serviceRoleKey}`,
          // Pass user context for RLS policies
          'x-supabase-auth-user-id': user_id,
          // Set role to service_role to bypass RLS
          'x-supabase-auth-role': 'service_role'
        }
      }
    }
  );
}

interface AggregatedResult {
  count?: number;
  statistics?: {
    user_id: string;
    username: string;
    count: number;
  }[];
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.replace(/\n/g, ' ')
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

async function getRelevantMessages(
  workspace_id: string,
  analysis: QueryAnalysis,
  user_id: string,
  channel_name?: string
): Promise<MessageContext[] | AggregatedResult> {
  try {
    // Create client with user context
    const supabaseClient = createSupabaseClient(user_id);

    console.log('Building filter with:', {
      workspace_id,
      user_id,
      channel_name,
      analysis: {
        type: analysis.type,
        entities: analysis.entities
      }
    });

    // Build filter
    const filter: Record<string, any> = {
      workspace_id
    };

    // Handle channel filtering
    if (channel_name) {
      filter.channel_name = channel_name.trim();
    } else if (analysis.entities.channels && analysis.entities.channels.length > 0) {
      filter.channel_name = analysis.entities.channels[0].trim();
    }

    // Handle user filtering - pass username directly in filter
    if (analysis.entities.users && analysis.entities.users.length > 0) {
      const username = analysis.entities.users[0].trim();
      filter.username = username; // Pass username directly, let the database function handle the lookup
    }

    // Handle timeframe filtering
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

    console.log('Using filter:', filter);

    // Determine message limit based on query type
    const messageLimit = analysis.type === QueryType.COUNT_QUERY ? 1000 :
                        analysis.type === QueryType.STATISTICAL_QUERY ? 500 :
                        analysis.type === QueryType.CHANNEL_CONTEXT ? 100 : 10;

    // Generate embedding for semantic search
    let queryEmbedding: number[] = [];
    try {
      // For count queries, we'll rely more on filters than semantic search
      if (analysis.type === QueryType.COUNT_QUERY || analysis.type === QueryType.STATISTICAL_QUERY) {
        // Use a simple embedding that won't affect the search much
        queryEmbedding = await generateEmbedding("messages in channel");
      } else {
        // For other queries, use the actual query for semantic search
        const searchText = analysis.entities.query || "recent messages";
        queryEmbedding = await generateEmbedding(searchText);
      }
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Continue with empty embedding, but log the error
    }

    // Call search_messages function
    const { data: messages, error } = await supabaseClient.rpc('search_messages', {
      query_embedding: queryEmbedding,
      filter,
      match_count: messageLimit
    });

    if (error) {
      console.error('Error searching messages:', error);
      return analysis.type === QueryType.COUNT_QUERY ? { count: 0 } :
             analysis.type === QueryType.STATISTICAL_QUERY ? { statistics: [] } : [];
    }

    // Handle empty messages
    if (!messages || messages.length === 0) {
      console.log('No messages found for filter:', filter);
      return analysis.type === QueryType.COUNT_QUERY ? { count: 0 } :
             analysis.type === QueryType.STATISTICAL_QUERY ? { statistics: [] } : [];
    }

    // Enrich messages with metadata before processing
    const enrichedMessages = await enrichContextWithMetadata(messages, workspace_id);

    // Handle different query types
    if (analysis.type === QueryType.COUNT_QUERY) {
      const count = enrichedMessages.length;
      console.log('Count result:', { count, filter });
      return { count };
    }

    if (analysis.type === QueryType.STATISTICAL_QUERY) {
      // Group messages by user and count using enriched data
      const userStats = enrichedMessages.reduce((acc: Record<string, any>, msg: MessageContext) => {
        if (!msg.user?.id) return acc;
        
        if (!acc[msg.user.id]) {
          acc[msg.user.id] = {
            user_id: msg.user.id,
            username: msg.user.username || 'Unknown',
            count: 0
          };
        }
        acc[msg.user.id].count++;
        return acc;
      }, {});

      // Convert to array and sort by count
      const stats = Object.values(userStats).sort((a: any, b: any) => 
        analysis.entities.aggregation?.operation === 'least' ? 
          a.count - b.count : b.count - a.count
      ) as { user_id: string; username: string; count: number; }[];

      return {
        statistics: stats.slice(0, 5)
      };
    }

    // For other query types, return enriched messages
    return enrichedMessages;
  } catch (error) {
    console.error('Error getting relevant messages:', error);
    // Return appropriate empty result based on query type
    if (analysis.type === QueryType.COUNT_QUERY) {
      return { count: 0 };
    }
    if (analysis.type === QueryType.STATISTICAL_QUERY) {
      return { statistics: [] };
    }
    return [];
  }
}

export async function assembleContext(
  message: string,
  workspace_id: string,
  user_id: string,
  channel_name?: string
): Promise<MessageContext[] | AggregatedResult> {
  try {
    // Analyze the query to determine context requirements
    const analysis = analyzeQuery(message);
    
    // Get relevant messages based on the query analysis
    return await getRelevantMessages(
      workspace_id,
      analysis,
      user_id,
      channel_name
    );
  } catch (error) {
    console.error('Error assembling context:', error);
    return [];
  }
} 