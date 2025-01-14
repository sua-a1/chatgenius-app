import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Remove edge runtime as it might be causing issues with environment variables
// export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

// Create a Supabase client with the service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: Request) {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      console.log('No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Session found:', { userId: session.user.id })

    const { workspace_id } = await request.json()

    if (!workspace_id) {
      console.log('No workspace_id provided')
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    console.log('Checking workspace membership:', { workspace_id, userId: session.user.id })

    // First check if workspace exists
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, owner_id')
      .eq('id', workspace_id)
      .single()

    if (workspaceError) {
      console.error('Error fetching workspace:', workspaceError)
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    console.log('Workspace found:', workspace)

    try {
      // Verify user has access to workspace
      const { data: userMembership, error: userMembershipError } = await supabase
        .from('workspace_memberships')
        .select('user_id, workspace_id, role')
        .eq('workspace_id', workspace_id)
        .eq('user_id', session.user.id)
        .single()

      if (userMembershipError) {
        console.error('User membership error:', userMembershipError)
        return NextResponse.json({ error: 'Unauthorized access to workspace' }, { status: 403 })
      }

      // Use service role client to check system user membership
      const { data: systemMembership, error: systemMembershipError } = await supabaseAdmin
        .from('workspace_memberships')
        .select('user_id, workspace_id, role')
        .eq('workspace_id', workspace_id)
        .eq('user_id', SYSTEM_USER_ID)
        .single()

      if (systemMembershipError) {
        console.error('System membership error:', systemMembershipError)
        return NextResponse.json({ error: 'AI assistant not configured for this workspace' }, { status: 403 })
      }

      // Create new AI conversation
      const { data: conversation, error: conversationError } = await supabase
        .from('ai_assistant_conversations')
        .insert({
          workspace_id,
          user_id: session.user.id
        })
        .select()
        .single()

      if (conversationError) {
        console.error('Error creating conversation:', conversationError)
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }

      console.log('Conversation created:', conversation)
      return NextResponse.json({ conversation })
    } catch (error) {
      console.error('Database operation error:', error)
      return NextResponse.json(
        { error: 'Database operation failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error starting AI chat:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 