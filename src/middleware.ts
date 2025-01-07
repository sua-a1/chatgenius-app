import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // Paths that don't require authentication
  const publicPaths = ['/auth/signin', '/auth/callback', '/auth/verify']
  const isPublicPath = publicPaths.some(path => req.nextUrl.pathname.startsWith(path))

  if (!session && !isPublicPath) {
    // Redirect to signin if accessing protected route without session
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/auth/signin'
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (session && isPublicPath && req.nextUrl.pathname !== '/auth/callback') {
    // Redirect to home if accessing auth pages while logged in
    return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
} 