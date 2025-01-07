'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const redirectTo = searchParams.get('redirectTo') || '/'

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      })

      if (error) {
        throw error
      }

      toast({
        title: 'Check your email',
        description: 'We sent you a magic link to sign in.',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialSignIn = async (provider: 'google' | 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      })

      if (error) throw error
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Could not authenticate with ' + provider,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Welcome to ChatGenius</CardTitle>
          <CardDescription>Enter your email to sign in or create an account.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 text-sm text-red-500">
              {decodeURIComponent(error)}
            </div>
          )}
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button 
              className="w-full" 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? 'Sending magic link...' : 'Continue with Email'}
            </Button>
          </form>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid gap-2">
            <Button
              variant="outline"
              onClick={() => handleSocialSignIn('google')}
              disabled={isLoading}
              className="w-full"
            >
              Google
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSocialSignIn('github')}
              disabled={isLoading}
              className="w-full"
            >
              GitHub
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 