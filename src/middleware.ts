import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Auth condition
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
  
  if (!session && !isAuthPage) {
    // Redirect unauthenticated users to login page
    return NextResponse.redirect(new URL('/auth/signin', req.url))
  }

  if (session && isAuthPage) {
    // Redirect authenticated users to home page if they try to access auth pages
    return NextResponse.redirect(new URL('/', req.url))
  }

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
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
} 