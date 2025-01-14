import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const conversation_id = resolvedParams.id
  
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Verify user has access to conversation
  const { data: conversation, error: conversationError } = await supabase
    .from('ai_assistant_conversations')
    .select('id')
    .eq('id', conversation_id)
    .eq('user_id', session.user.id)
    .single()

  if (conversationError || !conversation) {
    return NextResponse.json(
      { error: 'Unauthorized access to conversation' },
      { status: 403 }
    )
  }

  // Delete all messages first (due to foreign key constraint)
  const { error: messagesError } = await supabase
    .from('ai_assistant_messages')
    .delete()
    .eq('conversation_id', conversation_id)

  if (messagesError) {
    return NextResponse.json(
      { error: 'Failed to delete messages' },
      { status: 500 }
    )
  }

  // Delete the conversation
  const { error: deleteError } = await supabase
    .from('ai_assistant_conversations')
    .delete()
    .eq('id', conversation_id)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
} 