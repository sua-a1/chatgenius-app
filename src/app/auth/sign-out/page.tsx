'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'

export default function SignOutPage() {
  const { signOut } = useAuth()
  const hasStartedSignOut = useRef(false)

  useEffect(() => {
    const handleSignOut = async () => {
      if (hasStartedSignOut.current) return
      hasStartedSignOut.current = true

      try {
        // Clear all auth-related cookies first
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

        // Call the API to handle server-side sign-out
        try {
          const response = await fetch('/api/auth/sign-out', {
            method: 'POST',
            credentials: 'include',
          })

          if (!response.ok) {
            throw new Error('Failed to sign out')
          }
        } catch (error) {
          console.error('Error signing out:', error)
          // Continue with client-side sign-out even if API call fails
        }

        // Let the auth context handle the sign-out and navigation
        await signOut()
      } catch (error) {
        console.error('Error during sign out:', error)
        // Let the auth context handle navigation even on error
        await signOut()
      }
    }

    handleSignOut()
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