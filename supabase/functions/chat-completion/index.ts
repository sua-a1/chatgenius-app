import { serve, createClient, OpenAI, User, UserMapEntry } from './deps.ts';
import { analyzeQuery } from './message-analyzer.ts';
import { assembleContext } from './context-assembly.ts';
import { composeInstructions, getInstructionSet } from './instruction-sets.ts';
import { MessageContext, MessageMetadata, QueryType } from './types.ts';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  workspace_id: string;
  user_id: string;
  user?: {
    username?: string;
    full_name?: string;
  };
  context?: MessageContext[];
  channel_name?: string;
}

interface AggregatedResult {
  count?: number;
  statistics?: {
    user_id: string;
    username: string;
    count: number;
  }[];
}

function formatAggregatedResult(result: AggregatedResult, queryType: QueryType, channel_name?: string, timeframe?: string): string {
  const channelContext = channel_name ? ` in channel #${channel_name}` : '';
  const timeContext = timeframe ? ` during ${timeframe}` : '';

  if (queryType === QueryType.COUNT_QUERY) {
    if (typeof result.count !== 'number') {
      return 'Unable to determine message count due to an error.';
    }
    if (result.count === 0) {
      return `No messages found${channelContext}${timeContext}.`;
    }
    return `Based on the search criteria, I found exactly ${result.count} message(s)${channelContext}${timeContext}.`;
  }

  if (queryType === QueryType.STATISTICAL_QUERY) {
    if (!result.statistics) {
      return 'Unable to retrieve activity statistics due to an error.';
    }
    if (result.statistics.length === 0) {
      return `No user activity found${channelContext}${timeContext}.`;
    }

    const formattedStats = result.statistics
      .filter(stat => stat.username && stat.count > 0)
      .map(stat => `@${stat.username}: ${stat.count} message(s)`)
      .join('\n');

    if (!formattedStats) {
      return `No valid user activity statistics found${channelContext}${timeContext}.`;
    }

    return `Here are the user activity statistics${channelContext}${timeContext}:\n\n${formattedStats}`;
  }

  return 'Unsupported query type or invalid result format.';
}

// Initialize OpenAI client for each request
async function getOpenAIClient() {
  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    // Create client with minimal configuration
    const client = new OpenAI({ 
      apiKey,
      maxRetries: 1,
      timeout: 15000 // 15 seconds
    });

    // Test the client with a simple request
    await client.models.list();
    
    return client;
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error);
    throw new Error('OpenAI client initialization failed: ' + error.message);
  }
}

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: {
      persistSession: false
    }
  }
);

function formatContextMessages(relevantMessages: MessageContext[]): string {
  // Log initial message count
  console.log('Formatting context messages:', {
    inputCount: relevantMessages?.length || 0,
    hasMessages: !!relevantMessages && relevantMessages.length > 0,
    firstMessage: relevantMessages?.[0] ? {
      hasContent: !!relevantMessages[0].content,
      hasCreatedAt: !!relevantMessages[0].created_at,
      hasUser: !!relevantMessages[0].user,
      userId: relevantMessages[0].user?.id,
      username: relevantMessages[0].user?.username,
      channelName: relevantMessages[0].channel_name,
      isLatest: relevantMessages[0].is_latest,
      isDeleted: relevantMessages[0].is_deleted
    } : 'No messages'
  });

  if (!relevantMessages || relevantMessages.length === 0) {
    return 'No messages found in the context. This could mean either no messages exist in the specified channel/timeframe or the search did not return any relevant results.';
  }

  try {
    // Sort messages by timestamp and filter out deleted or non-latest versions
    const sortedMessages = [...relevantMessages]
      .filter(msg => {
        const isValid = msg && 
          msg.content && 
          msg.created_at && 
          msg.is_latest === true && 
          msg.is_deleted !== true;
        
        if (!isValid) {
          console.log('Filtered out message:', {
            hasContent: !!msg?.content,
            hasCreatedAt: !!msg?.created_at,
            isLatest: msg?.is_latest,
            isDeleted: msg?.is_deleted
          });
        }
        return isValid;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Log filtered message count
    console.log('Message filtering results:', {
      originalCount: relevantMessages.length,
      validCount: sortedMessages.length,
      filteredOut: relevantMessages.length - sortedMessages.length
    });

    if (sortedMessages.length === 0) {
      return 'No valid messages found in the context. All messages were filtered out due to being deleted, outdated versions, or having invalid content.';
    }

  // Group messages by day
  const messagesByDay = sortedMessages.reduce((acc, msg) => {
    const date = new Date(msg.created_at).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {} as Record<string, MessageContext[]>);

  // Format messages by day
    const formattedDays = Object.entries(messagesByDay).map(([date, messages]) => {
    const formattedMessages = messages.map(msg => {
      const time = new Date(msg.created_at).toLocaleTimeString();
      const channelInfo = msg.channel_name ? ` in #${msg.channel_name}` : '';
        
        // Handle user information carefully
        let userInfo = '@unknown_user';
        if (msg.user) {
          if (msg.user.full_name && msg.user.username) {
            userInfo = `${msg.user.full_name} (@${msg.user.username})`;
          } else if (msg.user.username) {
            userInfo = `@${msg.user.username}`;
          }
        }
        
        // Sanitize content
        const sanitizedContent = (msg.content || '')
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/"/g, '\\"')  // Escape quotes
          .trim();

        if (!sanitizedContent) {
          return null; // Skip empty messages
        }

        return `[${time}] ${userInfo}${channelInfo}: "${sanitizedContent}"`;
      })
      .filter(Boolean) // Remove null entries
      .join('\n');

    return `=== ${date} ===\n${formattedMessages}`;
    });

    const result = formattedDays.join('\n\n');
    
    // Log the length for debugging
    console.log('Formatted context stats:', {
      originalMessageCount: relevantMessages.length,
      validMessageCount: sortedMessages.length,
      formattedLength: result.length,
      dayCount: formattedDays.length
    });

    return result;
  } catch (error) {
    console.error('Error formatting context messages:', error);
    return 'Error formatting context messages. Using empty context.';
  }
}

function createSystemPrompt(
  workspaceContext: string,
  relevantContext: string,
  channelName?: string,
  username?: string,
  user_id?: string
): string {
  let contextualFocus = '';
  
  // Add channel context if available
  if (channelName) {
    contextualFocus += `\nYou are currently focusing on messages from the #${channelName} channel.`;
  }
  
  // Add user context if available
  if (username) {
    contextualFocus += `\nYou are currently focusing on messages from user @${username}.`;
  }

  // Build the base prompt
  const basePrompt = `You are a friendly AI assistant for a workspace chat application. Your role is to help users by providing accurate, helpful responses based on the context of their workspace.${contextualFocus}

WORKSPACE CONTEXT:
${workspaceContext}

You are currently talking to user_id: ${user_id || 'unknown'}. When asked about "me" or "my messages", you should focus on this user's messages and context.

RELEVANT MESSAGES FROM THE WORKSPACE:
The messages below are organized chronologically by date and time to help you understand the flow of conversation:

${relevantContext}

CRITICAL FORMATTING AND ACCURACY INSTRUCTIONS:
1. ONLY reference messages that are EXPLICITLY provided in the context above.
2. NEVER make up or hallucinate messages, users, timestamps, or content that isn't in the context.
3. When referencing messages, you MUST use one of these two formats EXACTLY:

Format 1 (for exact quotes):
"[Full Name] (@username) in #[channel] at [exact time]: '[exact quote]'"
Example: "Joy Future (@holame) in #Main 1 at 6:53:40 PM: 'Finally at baggage claim. What a day of insights and perspectives!'"

Format 2 (for paraphrasing):
"@username in #[channel] at [time] said/mentioned/asked/etc '[paraphrased quote]'"
Example: "@holame in #Main 1 at 5:30 PM mentioned she was 'at baggage claim'"

4. NEVER deviate from these formats when referencing messages
5. NEVER summarize multiple messages without using these formats for each message referenced
6. If you need to reference multiple messages, format EACH ONE separately using one of the above formats
7. If there are no relevant messages in the context, say so explicitly instead of making up information
8. If you're unsure about any information, acknowledge the uncertainty rather than making assumptions

Remember: These formatting rules are MANDATORY for EVERY single message reference in your responses. If you don't have enough context to answer a question, acknowledge that instead of making up information.`;

  console.log('Generated system prompt:', basePrompt);
  return basePrompt;
}

export async function enrichContextWithMetadata(messages: any[], workspace_id: string): Promise<MessageContext[]> {
  try {
    console.log('Enriching context with metadata. Message count:', messages.length);
    
    // Early validation of messages
    if (!Array.isArray(messages) || messages.length === 0) {
      console.log('No messages to enrich');
      return [];
    }

    // Get unique channel and user IDs
    const channelIds = new Set(messages.map(msg => msg.metadata?.channel_id).filter(Boolean));
    const userIds = new Set(messages.map(msg => msg.metadata?.user_id).filter(Boolean));

    // Create maps for channels and users
    const channelMap = new Map<string, string>();
    const userMap = new Map<string, UserMapEntry>();

    // Log first message structure for debugging
    if (messages[0]) {
      console.log('First message structure:', {
        hasMetadata: !!messages[0].metadata,
        hasContent: !!messages[0].content,
        version: messages[0].metadata?.version,
        isLatest: messages[0].metadata?.is_latest,
        isDeleted: messages[0].metadata?.is_deleted
      });
    }

    // Get channel names for active channels
    const { data: channels, error: channelsError } = await supabaseClient
      .from('channels')
      .select('id, name')
      .in('id', channelIds)
      .eq('workspace_id', workspace_id);
    
    if (channelsError) {
      console.error('Error fetching channels:', channelsError);
      throw channelsError;
    }

    channels.forEach(c => channelMap.set(c.id, c.name));

    // Get user information
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id, username, full_name')
      .in('id', userIds);
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    users.forEach(u => userMap.set(u.id, {
      username: u.username || undefined,
      full_name: u.full_name || undefined
    }));

    // Process and enrich messages
    return messages
      .filter(msg => {
        const isValid = msg && 
          msg.content && 
          msg.metadata?.created_at && 
          msg.metadata?.is_latest === true && 
          msg.metadata?.is_deleted !== true;
        
        if (!isValid) {
          console.log('Filtered out message:', {
            hasContent: !!msg?.content,
            hasCreatedAt: !!msg?.metadata?.created_at,
            isLatest: msg?.metadata?.is_latest,
            isDeleted: msg?.metadata?.is_deleted
          });
        }
        return isValid;
      })
      .map(msg => {
        const metadata = msg.metadata || {};
        const userEntry = metadata.user_id ? userMap.get(metadata.user_id) : undefined;
        const channelName = metadata.channel_id ? channelMap.get(metadata.channel_id) : undefined;
        
        const enrichedMessage: MessageContext = {
          content: metadata.original_message_content || msg.content,
          created_at: metadata.created_at,
          channel_id: metadata.channel_id,
          channel_name: channelName,
          user: metadata.user_id ? {
            id: metadata.user_id,
            username: userEntry?.username,
            full_name: userEntry?.full_name,
            email: metadata.user_email,
            avatar_url: metadata.user_avatar_url
          } : undefined,
          version: metadata.version,
          is_latest: metadata.is_latest === true,
          is_deleted: metadata.is_deleted === true
        };

        return enrichedMessage;
      });

    console.log('Enrichment complete:', {
      inputCount: messages.length,
      outputCount: messages.length,
      channelsFound: channelMap.size,
      usersFound: userMap.size
    });

    return messages;
  } catch (error) {
    console.error('Error in enrichContextWithMetadata:', error);
    throw error;
  }
}

async function getMessageCount(channelId: string): Promise<number> {
  const { count, error } = await supabaseClient
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('channel_id', channelId);

  if (error) {
    console.error('Error getting message count:', error);
    throw error;
  }

  return count || 0;
}

async function handleChatRequest(req: ChatRequest): Promise<Response> {
  try {
    const { message, workspace_id, user_id, user, channel_name } = req;

    // Analyze the query
    const analysis = analyzeQuery(message);
    console.log('Query analysis:', {
      type: analysis.type,
      entities: analysis.entities,
      contextRequirements: analysis.contextRequirements
    });
    
    // Get relevant context
    const contextResult = await assembleContext(
      message,
      workspace_id,
      user_id,
      channel_name
    );

    // Handle aggregated results differently
    if (analysis.type === QueryType.COUNT_QUERY || analysis.type === QueryType.STATISTICAL_QUERY) {
      const aggregatedResult = contextResult as AggregatedResult;
      const formattedResult = formatAggregatedResult(
        aggregatedResult, 
        analysis.type,
        channel_name,
        analysis.entities.timeframe
      );
      
      return new Response(
        JSON.stringify({
          message: formattedResult,
          metadata: {
            queryType: analysis.type,
            aggregatedResult,
            analysis: {
              entities: analysis.entities,
              contextRequirements: analysis.contextRequirements
            }
          }
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // For other query types, proceed with normal chat completion
    const openai = await getOpenAIClient();
    
    // Get appropriate instruction set and compose system prompt
    const instructionSet = getInstructionSet(analysis.type);
    const formattedContext = Array.isArray(contextResult) ? 
      formatContextMessages(contextResult) : 
      'No message context available.';

    // Build workspace context from instruction set
    const workspaceContext = [
      instructionSet.base,
      ...(instructionSet.contextInstructions || []),
      ...(analysis.contextRequirements?.needsTimeContext ? ['Consider the specified timeframe when providing context'] : []),
      ...(analysis.contextRequirements?.needsUserContext ? ['Focus on user-specific interactions and history'] : []),
      ...(analysis.contextRequirements?.needsChannelContext ? ['Consider channel-specific context and discussions'] : [])
    ].join('\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: createSystemPrompt(
          workspaceContext,
          formattedContext,
          channel_name,
          user?.username,
          user_id
        )
      },
      {
        role: 'user',
        content: message
      }
    ];

    console.log('Sending chat completion request:', {
      queryType: analysis.type,
      contextLength: formattedContext.length,
      hasUserContext: !!user,
      hasChannelContext: !!channel_name
    });

    // Get chat completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    return new Response(
      JSON.stringify({
        message: completion.choices[0].message.content,
        metadata: {
          queryType: analysis.type,
          messageCount: Array.isArray(contextResult) ? contextResult.length : 0,
          analysis: {
            entities: analysis.entities,
            contextRequirements: analysis.contextRequirements
          }
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in chat completion:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const chatRequest = await req.json() as ChatRequest;
    return handleChatRequest(chatRequest);
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: true, message: `Error processing request: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}); 