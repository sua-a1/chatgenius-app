import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { url }, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${new URL(request.url).origin}/auth/callback`,
    },
  })

  if (error) {
    return NextResponse.redirect(
      `${new URL(request.url).origin}/auth/signin?error=Could not authenticate user`,
      {
        status: 301,
      }
    )
  }

  return NextResponse.redirect(url!, {
    status: 301,
  })
} 