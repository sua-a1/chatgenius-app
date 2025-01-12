import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Explicitly export the HTTP methods this route handles
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // 1. Get current session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.access_token) {
      try {
        // 2. Kill the session directly via API
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
          }
        })

        // 3. Also try admin API to force logout
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${session.user.id}/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
            }
          })
        }
      } catch (error) {
        console.error('Direct session termination error:', error)
      }
    }

    // 4. Sign out from Supabase
    await supabase.auth.signOut({ scope: 'global' })

    // 5. Create response
    const response = new NextResponse(null, { status: 200 })
    
    // 6. Clear all possible auth cookies
    const cookiesToClear = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
      'sb-token',
      'sb-provider-token',
      'sb.access_token',
      'sb.refresh_token',
      'sb.provider_token'
    ]

    const paths = ['/', '/auth', '/api', '/app']
    
    cookiesToClear.forEach(name => {
      // First delete
      response.cookies.delete(name)
      
      // Then set expired for each path
      paths.forEach(path => {
        response.cookies.set(name, '', {
          expires: new Date(0),
          path,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          httpOnly: true
        })
      })
    })

    // 7. Set strong cache control headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
    
    return response
  } catch (error) {
    console.error('Sign-out error:', error)
    // Return success anyway to ensure client continues with redirect
    return new NextResponse(null, { status: 200 })
  }
} 