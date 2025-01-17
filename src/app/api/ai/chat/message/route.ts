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
    });

    // Get user profile to ensure we have the username
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('username, full_name')
      .eq('id', session.user.id)
      .single();

    if (userError) {
      console.error('Error fetching user profile:', userError);
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    try {
      // Call chat-completion function with the message and workspace context
      const { data: completion, error: completionError } = await supabase.functions.invoke('chat-completion', {
        body: {
          conversation_id,
          message,
          workspace_id: conversation.workspace_id,
          user_id: session.user.id,
          user: {
            id: session.user.id,
            email: session.user.email,
            username: userProfile.username,
            full_name: userProfile.full_name
          }
        }
      });

      if (completionError) {
        console.error('Error calling chat-completion:', completionError)
        return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
      }

      if (!completion) {
        console.error('No completion data received')
        return NextResponse.json({ error: 'No response received' }, { status: 500 })
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
      console.error('Error in chat completion:', error)
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