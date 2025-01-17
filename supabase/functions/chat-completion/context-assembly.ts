import { QueryType, QueryAnalysis, MessageContext, AggregatedResult } from './types.ts';
import { createSupabaseClient } from './deps.ts';
import { generateEmbedding, enrichContextWithMetadata } from './index.ts';
import { analyzeQuery, cleanChannelName } from './message-analyzer.ts';

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
        entities: analysis.entities,
        users: analysis.entities.users
      }
    });

    // Build filter
    const filter: Record<string, any> = {
      workspace_id
    };

    // Handle channel filtering - ensure channel names are cleaned
    if (channel_name) {
      console.log('Channel name before cleaning:', channel_name);
      const cleaned = cleanChannelName(channel_name);
      console.log('Channel name after cleaning:', cleaned);
      filter.channel_name = cleaned;
    } else if (analysis.entities.channels && analysis.entities.channels.length > 0) {
      console.log('Channel from analysis before cleaning:', analysis.entities.channels[0]);
      const cleaned = cleanChannelName(analysis.entities.channels[0]);
      console.log('Channel from analysis after cleaning:', cleaned);
      filter.channel_name = cleaned;
    }

    // Handle user filtering - ensure we're using the correct username
    if (analysis.entities.users && analysis.entities.users.length > 0) {
      const username = analysis.entities.users[0].trim();
      console.log('Setting username filter:', username);
      filter.username = username;
    }

    // Handle topic filtering
    if (analysis.entities.topics && analysis.entities.topics.length > 0) {
      filter.topic = analysis.entities.topics[0].trim();
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
      let searchText = '';
      
      // Build search text based on query type and entities
      if (analysis.type === QueryType.COUNT_QUERY || analysis.type === QueryType.STATISTICAL_QUERY) {
        searchText = "messages in channel";
      } else if (analysis.entities.topics && analysis.entities.topics.length > 0) {
        // Include topic in semantic search
        const topic = analysis.entities.topics[0];
        searchText = `messages about ${topic}`;
        if (analysis.type === QueryType.SUMMARY_QUERY) {
          searchText = `discussions and opinions about ${topic}`;
        }
      } else if (analysis.entities.users && analysis.entities.users.length > 0) {
        // Include user context in search text
        const username = analysis.entities.users[0];
        searchText = `messages sent by ${username}`;
      } else {
        searchText = "recent messages";
      }

      console.log('Generating embedding for search text:', searchText);
      queryEmbedding = await generateEmbedding(searchText);
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
  channel_name?: string,
  currentUsername?: string
): Promise<MessageContext[] | AggregatedResult> {
  try {
    // Analyze the query to determine context requirements with current username
    const analysis = analyzeQuery(message, currentUsername);
    
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