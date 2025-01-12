import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { url }, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${new URL(request.url).origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
        scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      },
    },
  })

  if (error) {
    return NextResponse.redirect(
      `${new URL(request.url).origin}/auth/sign-in?error=Could not authenticate user`,
      {
        status: 301,
      }
    )
  }

  return NextResponse.redirect(url!, {
    status: 301,
  })
} 