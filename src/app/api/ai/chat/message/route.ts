import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OpenAIEmbeddings } from '@langchain/openai'
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase'

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

    // Create vector store
    const vectorStore = await SupabaseVectorStore.fromExistingIndex(embeddings, {
      client: supabase,
      tableName: 'message_embeddings',
      queryName: 'search_messages'
    })

    // Extract channel name if the message is asking about a specific channel
    let channelName = null;
    const channelMatch = message.match(/channel\s+(?:"|'|#)?([^"'#\n]+)(?:"|')?/i);
    if (channelMatch) {
      channelName = channelMatch[1].trim();
    }

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

    // Search for relevant context
    const searchResults = await vectorStore.similaritySearch(message, messageLimit, {
      filter: { 
        workspace_id: conversation.workspace_id,
        ...(channelName && { channel_name: channelName })
      }
    })

    console.log('Search results:', JSON.stringify(searchResults.map(r => ({
      content: r.pageContent,
      metadata: r.metadata
    })), null, 2));

    // Map search results to enriched format
    const enrichedResults = searchResults.map(doc => ({
      content: doc.pageContent,
      created_at: doc.metadata.created_at,
      channel_id: doc.metadata.channel_id,
      channel_name: doc.metadata.channel_name,
      user_id: doc.metadata.user_id,
      username: doc.metadata.username,
      user_full_name: doc.metadata.full_name,
      metadata: doc.metadata
    }));

    console.log('Enriched results:', JSON.stringify(enrichedResults, null, 2));

    // Get conversation history
    const { data: history = [] } = await supabase
      .from('ai_assistant_messages')
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(10)

    // Call chat-completion function
    const { data: completion, error: completionError } = await supabase.functions.invoke('chat-completion', {
      body: {
        conversation_id,
        message,
        workspace_id: conversation.workspace_id,
        ...(channelName && { channel_name: channelName }),
        context: enrichedResults
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
    console.error('Error processing message:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 