'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'

export default function SignOutPage() {
  const { signOut } = useAuth()
  const hasStartedSignOut = useRef(false)

  useEffect(() => {
    if (hasStartedSignOut.current) return
    hasStartedSignOut.current = true

    // Clear all auth-related cookies
    const cookies = ['sb-access-token', 'sb-refresh-token', 'supabase-auth-token']
    cookies.forEach(name => {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; domain=${window.location.hostname}`
    })

    // Clear local storage
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('supabase.auth.token')
      window.localStorage.removeItem('supabase.auth.expires_at')
      window.localStorage.removeItem('supabase.auth.refresh_token')
    }

    // Let the auth context handle the sign-out and navigation
    signOut().catch(() => {
      // Ignore timeout errors, the cleanup has already been done
      window.location.href = '/'
    })
  }, [signOut])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Signing out...</CardTitle>
          <CardDescription>Please wait while we sign you out.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 