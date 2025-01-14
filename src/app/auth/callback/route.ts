import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${requestUrl.origin}/auth/sign-in?error=No code provided`)
  }

  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Exchange the code for a session
    const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) throw exchangeError

    if (!session?.user) {
      throw new Error('No session or user found after code exchange')
    }

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

    // Set the session cookie
    const response = NextResponse.redirect(`${requestUrl.origin}/app`)
    response.cookies.set('supabase-auth-token', session.access_token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })

    return response
  } catch (error: any) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/sign-in?error=${encodeURIComponent(error.message || 'An unexpected error occurred')}`
    )
  }
} 