import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversation_id = searchParams.get('conversation_id')
    const workspace_id = searchParams.get('workspace_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // First verify workspace membership
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_memberships')
      .select('workspace_id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', session.user.id)
      .single()

    if (membershipError || !membership) {
      console.error('Workspace membership check failed:', {
        error: membershipError,
        workspace_id,
        user_id: session.user.id
      })
      return NextResponse.json({ error: 'Unauthorized access to workspace' }, { status: 403 })
    }

    console.log('Fetching conversations for workspace:', workspace_id, 'user:', session.user.id)

    // If no conversation_id, return list of conversations for the workspace
    if (!conversation_id) {
      const { data: conversations, error: conversationsError } = await supabase
        .from('ai_assistant_conversations')
        .select('id, created_at, last_message_at')
        .eq('workspace_id', workspace_id)
        .eq('user_id', session.user.id)
        .order('last_message_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (conversationsError) {
        console.error('Error fetching conversations:', {
          error: conversationsError,
          workspace_id,
          user_id: session.user.id
        })
        return NextResponse.json({ 
          error: 'Failed to fetch conversations',
          details: conversationsError.message
        }, { status: 500 })
      }

      console.log('Found conversations:', conversations?.length || 0)
      return NextResponse.json({ conversations: conversations || [] })
    }

    // Verify user has access to conversation and workspace
    const { data: conversation, error: conversationError } = await supabase
      .from('ai_assistant_conversations')
      .select('id')
      .eq('id', conversation_id)
      .eq('workspace_id', workspace_id)
      .eq('user_id', session.user.id)
      .single()

    if (conversationError || !conversation) {
      console.error('Conversation access check failed:', {
        error: conversationError,
        conversation_id,
        workspace_id,
        user_id: session.user.id
      })
      return NextResponse.json({ error: 'Unauthorized access to conversation' }, { status: 403 })
    }

    // Get conversation messages with pagination
    const { data: messages, error: messagesError } = await supabase
      .from('ai_assistant_messages')
      .select(`
        *,
        conversation:ai_assistant_conversations!inner(
          id,
          workspace_id,
          user_id
        )
      `)
      .eq('conversation_id', conversation_id)
      .eq('conversation.workspace_id', workspace_id)
      .eq('conversation.user_id', session.user.id)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (messagesError) {
      console.error('Error fetching messages:', {
        error: messagesError,
        conversation_id,
        workspace_id,
        user_id: session.user.id
      })
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Debug log the messages and their workspace context
    console.log('Messages retrieved:', {
      count: messages?.length,
      workspace_id,
      conversation_id,
      user_id: session.user.id,
      messages: messages?.map(msg => ({
        id: msg.id,
        conversation_workspace_id: msg.conversation.workspace_id,
        conversation_user_id: msg.conversation.user_id,
        content_preview: msg.content.substring(0, 50)
      }))
    })

    // Filter out any messages that don't match the workspace and user
    const filteredMessages = messages?.filter(msg => 
      msg.conversation.workspace_id === workspace_id && 
      msg.conversation.user_id === session.user.id
    ) || []

    // Log if we found any mismatched messages
    if (filteredMessages.length !== messages?.length) {
      console.warn('Found messages from wrong workspace/user:', {
        total_messages: messages?.length,
        filtered_messages: filteredMessages.length,
        workspace_id,
        user_id: session.user.id,
        conversation_id
      })
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('ai_assistant_messages')
      .select(`
        id,
        conversation:ai_assistant_conversations!inner(
          id,
          workspace_id,
          user_id
        )
      `, { 
        count: 'exact', 
        head: true 
      })
      .eq('conversation_id', conversation_id)
      .eq('conversation.workspace_id', workspace_id)
      .eq('conversation.user_id', session.user.id)

    if (countError) {
      console.error('Error fetching message count:', {
        error: countError,
        conversation_id
      })
      return NextResponse.json({ error: 'Failed to fetch message count' }, { status: 500 })
    }

    const total = count ?? 0

    return NextResponse.json({ 
      messages: filteredMessages,
      pagination: {
        total,
        offset,
        limit,
        hasMore: total > offset + limit
      }
    })
  } catch (error) {
    console.error('Error in chat history route:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 