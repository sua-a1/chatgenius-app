import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session if expired - required for Server Components
  const { data: { session }, error } = await supabase.auth.getSession()

  // Log auth state for debugging
  console.log('Auth state:', { 
    path: req.nextUrl.pathname,
    hasSession: !!session,
    error: error?.message 
  })

  // Auth condition
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
  const isSignOutPage = req.nextUrl.pathname === '/auth/sign-out'
  const isLandingPage = req.nextUrl.pathname === '/'
  const isPublicRoute = isAuthPage || isLandingPage
  
  if (!session && !isPublicRoute) {
    // Redirect unauthenticated users to login page
    const redirectUrl = new URL('/auth/sign-in', req.url)
    console.log('Redirecting to:', redirectUrl.toString())
    return NextResponse.redirect(redirectUrl)
  }

  if (session && isAuthPage && !isSignOutPage) {
    // Redirect authenticated users to app page if they try to access auth pages
    // except for the sign-out page
    const redirectUrl = new URL('/app', req.url)
    console.log('Redirecting to:', redirectUrl.toString())
    return NextResponse.redirect(redirectUrl)
  }

  // Update response to include new session
  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|public/|api/).*)',
  ],
} 