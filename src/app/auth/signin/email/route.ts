import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const formData = await request.formData()
    const email = String(formData.get('email'))
    const supabase = createRouteHandlerClient({ cookies })

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${requestUrl.origin}/auth/callback`,
      },
    })

    if (error) {
      console.error('Sign in error:', error)
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/signin?error=${encodeURIComponent(error.message)}`,
        { status: 301 }
      )
    }

    return NextResponse.redirect(
      `${requestUrl.origin}/auth/verify?email=${encodeURIComponent(email)}`,
      { status: 301 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.redirect(
      `${request.url}/auth/signin?error=An unexpected error occurred`,
      { status: 301 }
    )
  }
} 