// @ts-ignore: Deno deployment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  conversation_id: string;
  message: string;
  workspace_id: string;
  channel_id?: string;  // Optional channel context
  user_id?: string;     // Optional user context
}

interface RelevantContext {
  content: string;
  created_at: string;
  channel_id: string;
  user_id?: string;
  channel_name?: string;
  username?: string;
  user_full_name?: string;
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

function formatContextMessages(relevantMessages: RelevantContext[]): string {
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
  }, {} as Record<string, RelevantContext[]>);

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

  return `You are an AI assistant for a workspace chat application. Your role is to help users by providing accurate, helpful responses based on the context of their workspace.${contextualFocus}

WORKSPACE CONTEXT:
${workspaceContext}

RELEVANT MESSAGES FROM THE WORKSPACE:
The messages below are organized chronologically by date and time to help you understand the flow of conversation:

${relevantContext}

INSTRUCTIONS:
1. MOST IMPORTANT: Every response MUST follow this EXACT format when mentioning users or messages:
   "[Full Name] (@username) in #[channel] at [exact time]: '[exact quote]'"
   Example: "Joy Future (@holame) in #Main 1 at 6:53:40 PM: 'Finally at baggage claim. What a day of insights and perspectives!'"

2. When answering questions about users or messages:
   - Start your response with "According to the messages,"
   - Include the COMPLETE user attribution as shown above
   - Never paraphrase - use exact quotes
   - Include ALL relevant messages from that user in chronological order

3. When summarizing conversations:
   - Start each point with complete user attribution
   - Use exact quotes, not paraphrasing
   - Maintain chronological order
   - Include full attribution for every point

4. NEVER respond without including:
   - Full name
   - @username
   - Channel name with #
   - Exact time
   - Exact quote

5. For questions about "who":
   - Always start with "According to the messages,"
   - List ALL relevant messages from that user
   - Use complete attribution format for each message

Remember: EVERY response MUST include COMPLETE user attribution (Full Name, @username, #channel, exact time) and EXACT quotes. Never summarize without attribution.`;
}

async function enrichContextWithMetadata(messages: any[], workspace_id: string): Promise<RelevantContext[]> {
  try {
    // Get channel names
    const channelIds = [...new Set(messages.map(m => m.metadata?.channel_id).filter(Boolean))];
    const { data: channels, error: channelsError } = await supabaseClient
      .from('channels')
      .select('id, name')
      .in('id', channelIds)
      .eq('workspace_id', workspace_id);
    
    if (channelsError) {
      console.error('Error fetching channels:', channelsError);
      throw channelsError;
    }

    const channelMap = new Map(channels?.map(c => [c.id, c.name]) || []);

    // Get usernames if messages have user_ids
    const userIds = [...new Set(messages.map(m => m.metadata?.user_id).filter(Boolean))];
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id, username, full_name')
      .in('id', userIds);
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    const userMap = new Map(users?.map(u => [u.id, {
      username: u.username,
      full_name: u.full_name
    }]) || []);

    // Enrich messages with channel names and usernames
    return messages.map(msg => ({
      content: msg.content,
      created_at: msg.metadata?.created_at,
      channel_id: msg.metadata?.channel_id,
      user_id: msg.metadata?.user_id,
      channel_name: msg.metadata?.channel_id ? channelMap.get(msg.metadata.channel_id) : undefined,
      username: msg.metadata?.user_id ? userMap.get(msg.metadata.user_id)?.username : undefined,
      user_full_name: msg.metadata?.user_id ? userMap.get(msg.metadata.user_id)?.full_name : undefined
    }));
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
    const { conversation_id, message, workspace_id, channel_id, user_id, context } = await req.json();
    console.log('Request params:', { conversation_id, message, workspace_id, channel_id, user_id });

    // Check if this is a message count query
    const isCountQuery = message.toLowerCase().includes('how many messages') || 
                        message.toLowerCase().includes('number of messages') ||
                        message.toLowerCase().includes('message count') ||
                        message.toLowerCase().includes('count of messages');

    let additionalContext = '';
    if (isCountQuery && channel_id) {
      const count = await getMessageCount(channel_id);
      additionalContext = `\nThere are exactly ${count} messages in this channel.`;
    }

    // 1. Get conversation history
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

    // 2. Get workspace info
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

    // 3. Get specific channel or user info if provided
    let channelName, username;
    if (channel_id) {
      console.log('Fetching channel info...');
      const { data: channel, error: channelError } = await supabaseClient
        .from('channels')
        .select('name')
        .eq('id', channel_id)
        .single();
      
      if (channelError) {
        console.error('Error fetching channel:', channelError);
        throw channelError;
      }
      channelName = channel?.name;
    }
    if (user_id) {
      console.log('Fetching user info...');
      const { data: user, error: userError } = await supabaseClient
        .from('users')
        .select('username')
        .eq('id', user_id)
        .single();
      
      if (userError) {
        console.error('Error fetching user:', userError);
        throw userError;
      }
      username = user?.username;
    }

    // 4. Construct the messages array for OpenAI
    console.log('Constructing messages for OpenAI...');
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: createSystemPrompt(
          `Workspace: ${workspace.name}${additionalContext}`,
          formatContextMessages(context || []),
          channelName,
          username
        )
      },
      ...(conversationHistory || []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // 5. Get completion from OpenAI
    console.log('Getting completion from OpenAI...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: createSystemPrompt(
            `Workspace: ${workspace.name}${additionalContext}`,
            formatContextMessages(context || []),
            channelName,
            username
          )
        },
        ...(conversationHistory || []).map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.1, // Very low temperature for consistent formatting
      max_tokens: 1000,
      presence_penalty: -0.5, // Encourage focusing on provided information
      frequency_penalty: 0.3, // Discourage repetition
      stream: false
    });

    const assistantMessage = completion.choices[0].message;

    return new Response(
      JSON.stringify({
        message: assistantMessage.content,
        metadata: {
          model: 'gpt-3.5-turbo',
          context_messages: context?.length || 0
        }
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in chat-completion:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
}); 