import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OpenAIEmbeddings } from '@langchain/openai'
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase'

// Define search filter interface
interface SearchFilter {
  workspace_id: string;
  channel_name?: string;
  created_at_gte?: string;
  created_at_lte?: string;
}

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversation_id, message } = await request.json()

    if (!conversation_id || !message) {
      return NextResponse.json({ error: 'Conversation ID and message are required' }, { status: 400 })
    }

    // Verify user has access to conversation
    const { data: conversation, error: conversationError } = await supabase
      .from('ai_assistant_conversations')
      .select('workspace_id')
      .eq('id', conversation_id)
      .single()

    if (conversationError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Verify user has access to the workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_memberships')
      .select('role')
      .eq('workspace_id', conversation.workspace_id)
      .eq('user_id', session.user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Unauthorized access to workspace' }, { status: 403 })
    }

    // Store user message
    const { error: messageError } = await supabase
      .from('ai_assistant_messages')
      .insert({
        conversation_id,
        role: 'user',
        content: message
      })

    if (messageError) {
      console.error('Message storage error:', messageError);
      console.error('Message details:', {
        conversation_id,
        role: 'user',
        content: message?.substring(0, 100) // Log first 100 chars only
      });
      return NextResponse.json({ error: `Failed to store message: ${messageError.message}` }, { status: 500 })
    }

    // Initialize OpenAI embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY
    })

    // Create vector store with no initialization filter
    const vectorStore = await SupabaseVectorStore.fromExistingIndex(embeddings, {
      client: supabase,
      tableName: 'message_embeddings',
      queryName: 'search_messages'
    });

    // Extract channel name if the message is asking about a specific channel
    let channelName = null;
    const channelMatch = message.match(/channel\s+(?:"|'|#)?([^"'#\n]+)(?:"|')?/i);
    if (channelMatch) {
      // Clean the channel name - remove trailing punctuation and whitespace
      channelName = channelMatch[1].trim().replace(/[.,!?]+$/, '');
    }

    // Also check for direct channel references like "#Main 1"
    if (!channelName) {
      const directChannelMatch = message.match(/#([^.,!?\s]+(?:\s+[^.,!?\s]+)*)/);
      if (directChannelMatch) {
        channelName = directChannelMatch[1].trim();
      }
    }

    console.log('Extracted channel name:', channelName);

    // Determine the number of messages to retrieve based on query type
    const isSummaryQuery = message.toLowerCase().includes('summary') || 
                          message.toLowerCase().includes('summarize') ||
                          message.toLowerCase().includes('summarise') ||
                          message.toLowerCase().includes('what has been discussed') ||
                          message.toLowerCase().includes('what was discussed') ||
                          message.toLowerCase().includes('what have people talked about') ||
                          message.toLowerCase().includes('what did people talk about');

    const messageLimit = channelName ? 100 : // Use higher limit for channel-specific queries
                        isSummaryQuery ? 50 : 
                        20;  // Default limit for other queries

    // Build search filter
    const searchFilter: SearchFilter = {
      workspace_id: conversation.workspace_id
    };

    // Add channel name if specified
    if (channelName) {
      searchFilter.channel_name = channelName;
    }

    // Add time-based filtering if specified in the message
    if (message.toLowerCase().includes('today') || message.toLowerCase().includes('recent')) {
      const now = new Date();
      const startTime = new Date();
      startTime.setHours(now.getHours() - 24);
      searchFilter.created_at_gte = startTime.toISOString();
      searchFilter.created_at_lte = now.toISOString();
    }

    console.log('Searching with filter:', JSON.stringify(searchFilter, null, 2));

    try {
      // Search for relevant context
      const searchResults = await vectorStore.similaritySearch(
        message,
        messageLimit,
        searchFilter  // Pass filter directly
      );

      console.log('Raw search results:', {
        count: searchResults.length,
        filter: searchFilter,
        messageLimit,
        firstResult: searchResults[0] ? {
          content: searchResults[0].pageContent?.substring(0, 100),
          metadata: searchResults[0].metadata,
          workspace_id: searchResults[0].metadata?.workspace_id,
          is_latest: searchResults[0].metadata?.is_latest,
          is_deleted: searchResults[0].metadata?.is_deleted
        } : 'No results'
      });

      // Map search results to enriched format
      const enrichedResults = searchResults.map(doc => ({
        content: doc.pageContent,
        created_at: doc.metadata.created_at,
        channel_id: doc.metadata.channel_id,
        channel_name: doc.metadata.channel_name,
        user: doc.metadata.user_id ? {
          id: doc.metadata.user_id,
          username: doc.metadata.username,
          full_name: doc.metadata.full_name,
          email: doc.metadata.user_email,
          avatar_url: doc.metadata.user_avatar_url
        } : undefined,
        version: doc.metadata.version,
        is_latest: doc.metadata.is_latest,
        is_deleted: doc.metadata.is_deleted,
        original_message_content: doc.metadata.original_message_content
      }));

      console.log('Enriched results count:', enrichedResults.length);
      console.log('First enriched result:', enrichedResults[0] ? {
        content: enrichedResults[0].content?.substring(0, 100),
        user: enrichedResults[0].user,
        channel: enrichedResults[0].channel_name,
        is_latest: enrichedResults[0].is_latest,
        is_deleted: enrichedResults[0].is_deleted
      } : 'No results');

      // Filter out any messages that are deleted or not latest version
      const validResults = enrichedResults.filter(msg => 
        msg.is_latest === true && 
        msg.is_deleted !== true
      );

      console.log('Valid results count:', validResults.length);
      console.log('Search filter used:', searchFilter);
      console.log('Message limit used:', messageLimit);

      // Log the context being sent
      console.log('Final context being sent to chat-completion:', {
        messageCount: validResults.length,
        sampleMessage: validResults[0] ? {
          content: validResults[0].content?.substring(0, 100),
          channel: validResults[0].channel_name,
          user: validResults[0].user,
          created_at: validResults[0].created_at,
          metadata: {
            is_latest: validResults[0].is_latest,
            is_deleted: validResults[0].is_deleted,
            version: validResults[0].version
          }
        } : null
      });

      // Call chat-completion function
      const { data: completion, error: completionError } = await supabase.functions.invoke('chat-completion', {
        body: {
          conversation_id,
          message,
          workspace_id: conversation.workspace_id,
          user_id: session.user.id,
          user: {
            id: session.user.id,
            email: session.user.email,
            username: session.user.user_metadata?.username,
            full_name: session.user.user_metadata?.full_name
          },
          ...(channelName && { channel_name: channelName }),
          context: validResults
        }
      })

      if (completionError) {
        console.error('Error calling chat-completion:', completionError)
        return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
      }

      if (!completion) {
        console.error('No completion data received')
        return NextResponse.json({ error: 'No response received' }, { status: 500 })
      }

      if (typeof completion !== 'object' || !completion.message || typeof completion.message !== 'string') {
        console.error('Invalid completion format:', completion)
        return NextResponse.json({ error: 'Invalid response format' }, { status: 500 })
      }

      // If the completion indicates an error, return it
      if (completion.error) {
        console.error('Edge function returned error:', completion)
        return NextResponse.json({ error: completion.message }, { status: 500 })
      }

      // Store AI response
      const { error: aiMessageError } = await supabase
        .from('ai_assistant_messages')
        .insert({
          conversation_id,
          role: 'assistant',
          content: completion.message
        })

      if (aiMessageError) {
        console.error('Error storing AI response:', aiMessageError)
        return NextResponse.json({ error: 'Failed to store AI response' }, { status: 500 })
      }

      return NextResponse.json({ 
        response: completion.message,
        metadata: completion.metadata 
      })
    } catch (error) {
      console.error('Error searching:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error processing message:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 