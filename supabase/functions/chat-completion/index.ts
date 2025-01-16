import { serve, createClient, OpenAI, User, UserMapEntry } from './deps.ts';
import { analyzeQuery } from './message-analyzer.ts';
import { assembleContext } from './context-assembly.ts';
import { composeInstructions } from './instruction-sets.ts';
import { MessageContext } from './types.ts';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  conversation_id: string;
  message: string;
  workspace_id: string;
  channel_id?: string;
  user_id?: string;
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
});

// Initialize Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function formatContextMessages(relevantMessages: MessageContext[]): string {
  // Sort messages by timestamp
  const sortedMessages = [...relevantMessages].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Group messages by day
  const messagesByDay = sortedMessages.reduce((acc, msg) => {
    const date = new Date(msg.created_at).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {} as Record<string, MessageContext[]>);

  // Format messages by day
  return Object.entries(messagesByDay).map(([date, messages]) => {
    const formattedMessages = messages.map(msg => {
      const time = new Date(msg.created_at).toLocaleTimeString();
      const channelInfo = msg.channel_name ? ` in #${msg.channel_name}` : '';
      const userInfo = msg.user_full_name && msg.username ? 
        `${msg.user_full_name} (@${msg.username})` : 
        msg.username ? 
        `@${msg.username}` : 
        '@unknown_user';
      return `[${time}] ${userInfo}${channelInfo}: "${msg.content}"`;
    }).join('\n');
    return `=== ${date} ===\n${formattedMessages}`;
  }).join('\n\n');
}

function createSystemPrompt(workspaceContext: string, relevantContext: string, channelName?: string, username?: string): string {
  let contextualFocus = '';
  if (channelName) {
    contextualFocus += `\nYou are currently focusing on messages from the #${channelName} channel.`;
  }
  if (username) {
    contextualFocus += `\nYou are currently focusing on messages from user @${username}.`;
  }

  return `You are a friendly AI assistant for a workspace chat application. Your role is to help users by providing accurate, helpful responses based on the context of their workspace.${contextualFocus}

WORKSPACE CONTEXT:
${workspaceContext}

RELEVANT MESSAGES FROM THE WORKSPACE:
The messages below are organized chronologically by date and time to help you understand the flow of conversation:

${relevantContext}

CRITICAL FORMATTING INSTRUCTIONS:
1. You MUST format EVERY SINGLE message reference in your responses using one of these two formats EXACTLY:

Format 1 (for exact quotes):
"[Full Name] (@username) in #[channel] at [exact time]: '[exact quote]'"
Example: "Joy Future (@holame) in #Main 1 at 6:53:40 PM: 'Finally at baggage claim. What a day of insights and perspectives!'"

Format 2 (for paraphrasing):
"@username in #[channel] at [time] said/mentioned/asked/etc '[paraphrased quote]'"
Example: "@holame in #Main 1 at 5:30 PM mentioned she was 'at baggage claim'"

2. NEVER deviate from these formats when referencing messages
3. NEVER summarize multiple messages without using these formats for each message referenced
4. If you need to reference multiple messages, format EACH ONE separately using one of the above formats

Remember: These formatting rules are MANDATORY for EVERY single message reference in your responses.`;
}

async function enrichContextWithMetadata(messages: any[], workspace_id: string): Promise<MessageContext[]> {
  try {
    console.log('Enriching context with metadata for messages:', messages);
    
    // Get channel names
    const channelIds = [...new Set(messages.map(m => m.metadata?.channel_id).filter(Boolean))];
    console.log('Channel IDs:', channelIds);
    
    const { data: channels, error: channelsError } = await supabaseClient
      .from('channels')
      .select('id, name')
      .in('id', channelIds)
      .eq('workspace_id', workspace_id);
    
    if (channelsError) {
      console.error('Error fetching channels:', channelsError);
      throw channelsError;
    }
    console.log('Fetched channels:', channels);

    const channelMap = new Map(channels?.map(c => [c.id, c.name as string]) || []);

    // Get usernames if messages have user_ids
    const userIds = [...new Set(messages.map(m => m.metadata?.user_id).filter(Boolean))];
    console.log('User IDs:', userIds);
    
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id, username, full_name')
      .in('id', userIds);
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }
    console.log('Fetched users:', users);

    const userMap = new Map((users || []).map(u => [u.id, {
      username: u.username || undefined,
      full_name: u.full_name || undefined
    }])) as Map<string, UserMapEntry>;

    // Enrich messages with channel names and usernames
    return messages.map(msg => ({
      content: msg.content,
      created_at: msg.metadata?.created_at,
      channel_id: msg.metadata?.channel_id,
      user_id: msg.metadata?.user_id,
      channel_name: msg.metadata?.channel_id ? channelMap.get(msg.metadata.channel_id) : undefined,
      username: msg.metadata?.user_id ? (userMap.get(msg.metadata.user_id) as UserMapEntry)?.username : undefined,
      user_full_name: msg.metadata?.user_id ? (userMap.get(msg.metadata.user_id) as UserMapEntry)?.full_name : undefined
    })) as MessageContext[];
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

serve(async (req) => {
  try {
    console.log('Starting chat completion request...');
    const { conversation_id, message, workspace_id, channel_id, user_id } = await req.json() as ChatRequest;
    console.log('Request params:', { conversation_id, message, workspace_id, channel_id, user_id });

    // 1. Analyze the query
    const queryAnalysis = analyzeQuery(message);
    console.log('Query analysis:', queryAnalysis);

    // 2. Get conversation history
    console.log('Fetching conversation history...');
    const { data: conversationHistory, error: historyError } = await supabaseClient
      .from('ai_assistant_messages')
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });

    if (historyError) {
      console.error('Error fetching conversation history:', historyError);
      throw historyError;
    }

    // 3. Get workspace info
    console.log('Fetching workspace info...');
    const { data: workspace, error: workspaceError } = await supabaseClient
      .from('workspaces')
      .select('name')
      .eq('id', workspace_id)
      .single();

    if (workspaceError) {
      console.error('Error fetching workspace:', workspaceError);
      throw workspaceError;
    }

    // 4. Get relevant messages based on query analysis
    let relevantMessages: MessageContext[] = [];
    
    // First, get the embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: message,
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    
    // Prepare filter for search
    const searchFilter = {
      workspace_id: workspace_id,
      ...(queryAnalysis.entities.channels?.length ? { channel_name: queryAnalysis.entities.channels[0] } : {}),
      ...(queryAnalysis.entities.users?.length ? { username: queryAnalysis.entities.users[0] } : {})
    };

    const { data: matchedMessages, error: messagesError } = await supabaseClient.rpc(
      'search_messages',
      {
        query_embedding: queryEmbedding,
        filter: searchFilter,
        match_count: 50
      }
    );

    if (messagesError) {
      console.error('Error fetching relevant messages:', messagesError);
      throw messagesError;
    }

    if (matchedMessages && matchedMessages.length > 0) {
      // Map the search results to MessageContext format with proper type handling
      relevantMessages = matchedMessages.map(msg => ({
        content: msg.content,
        created_at: msg.metadata?.created_at,
        channel_id: msg.metadata?.channel_id,
        user_id: msg.metadata?.user_id,
        channel_name: msg.metadata?.channel_name,
        username: msg.metadata?.username || undefined,
        user_full_name: msg.metadata?.full_name || undefined
      }));
    }

    // 5. Assemble and filter context
    const filteredContext = assembleContext(relevantMessages, queryAnalysis, {
      maxContextItems: 10,
      recencyWeight: 0.4,
      channelWeight: 0.3,
      userWeight: 0.3,
      minScore: 0.2
    });

    // 6. Format context messages
    const formattedContext = formatContextMessages(filteredContext);

    // 7. Create the full system prompt with context
    const workspaceContext = `You are in the workspace "${workspace.name}".`;
    const systemPrompt = createSystemPrompt(workspaceContext, formattedContext, 
      queryAnalysis.entities.channels?.[0],
      queryAnalysis.entities.users?.[0]
    );

    // 8. Prepare messages for chat completion
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // 9. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-16k',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    // 10. Return the response
    return new Response(
      JSON.stringify({
        message: completion.choices[0].message.content,
        metadata: {
          finish_reason: completion.choices[0].finish_reason,
          workspace_id: workspace_id,
          channel_id: channel_id,
          user_id: user_id
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}); 