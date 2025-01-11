import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (!code) {
      return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=No code provided`)
    }

    // Exchange the code for a session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) throw exchangeError

    // Get the user data after exchanging the code
    const { data: { user }, error: getUserError } = await supabase.auth.getUser()
    if (getUserError) throw getUserError
    
    if (user) {
      // Check if user exists in our users table (get the most recent profile)
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fetchError) {
        throw fetchError
      }

      if (!existingUser) {
        // Create user profile if it doesn't exist
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email!,
            username: user.email!.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url || null,
            full_name: user.user_metadata?.full_name || null,
            notifications: {
              email: true,
              push: false
            },
            theme: 'light',
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error creating user profile:', insertError)
          throw insertError
        }
      }
    }

    // Redirect to app page instead of root
    return NextResponse.redirect(`${requestUrl.origin}/app`)
  } catch (error: any) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(
      `${new URL(request.url).origin}/auth/signin?error=${encodeURIComponent(error.message || 'An unexpected error occurred')}`
    )
  }
} 