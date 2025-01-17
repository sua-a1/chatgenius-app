import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function DELETE(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspace_id = searchParams.get('workspace_id')

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

    // Get all conversations for this workspace
    const { data: conversations, error: conversationsError } = await supabase
      .from('ai_assistant_conversations')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', session.user.id)

    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError)
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
    }

    const conversationIds = conversations?.map(c => c.id) || []

    if (conversationIds.length > 0) {
      // With CASCADE enabled, we only need to delete the conversations
      // and the messages will be automatically deleted
      const { error: deleteError } = await supabase
        .from('ai_assistant_conversations')
        .delete()
        .eq('workspace_id', workspace_id)
        .eq('user_id', session.user.id)

      if (deleteError) {
        console.error('Error deleting conversations:', deleteError)
        return NextResponse.json({ 
          error: 'Failed to delete conversations',
          details: deleteError.message
        }, { status: 500 })
      }

      console.log('Successfully deleted conversations and associated messages for workspace:', workspace_id)
    }

    return NextResponse.json({ 
      success: true,
      deleted: {
        conversations: conversationIds.length,
        workspace_id
      }
    })
  } catch (error) {
    console.error('Error in delete chat history route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 