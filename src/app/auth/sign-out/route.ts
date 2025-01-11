import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  
  // Sign out from Supabase
  await supabase.auth.signOut()
  
  // Create response with redirect
  const response = NextResponse.redirect(new URL('/auth/signin', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'), {
    // 301 status will force the browser to follow the redirect
    status: 301
  })
  
  // Clear auth cookies with explicit settings
  response.cookies.set('sb-access-token', '', { 
    maxAge: 0,
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax'
  })
  response.cookies.set('sb-refresh-token', '', {
    maxAge: 0,
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax'
  })

  return response
} 