'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useSearchParams } from 'next/navigation'
import { useState, useLayoutEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { motion } from 'framer-motion'

function SignInForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  useLayoutEffect(() => {
    // Pre-warm the Supabase connection
    supabase.auth.getSession().catch(() => {})
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    console.log('Initiating sign-in process for:', email)

    try {
      // Show toast immediately for better UX
      toast({
        title: 'Sending magic link...',
        description: 'Please wait while we prepare your sign-in link.',
      })

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true,
          data: {
            email,
          },
        },
      })

      if (error) {
        console.error('Sign-in error:', error)
        throw error
      }

      console.log('Magic link sent successfully')
      toast({
        title: 'Check your email',
        description: 'We sent you a magic link to sign in. It may take a minute to arrive.',
      })
    } catch (error: any) {
      console.error('Sign-in process failed:', error)
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-[#4A3B8C]/2 to-[#5D3B9E]/3 overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-10 w-96 h-96 bg-[#b2b0b5]/10 rounded-full animate-float" />
        <div className="absolute top-3/4 -right-10 w-96 h-96 bg-[#b2b0b5]/10 rounded-full animation-delay-2000 animate-float" />
        <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-[#b2b0b5]/10 rounded-full animation-delay-4000 animate-float" />
      </div>

      <div className="flex min-h-screen items-center justify-center relative z-10">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="w-[350px] border-[#4A3B8C]/20">
            <CardHeader>
              <CardTitle className="text-2xl bg-clip-text text-transparent bg-gradient-to-r from-[#4A3B8C] to-[#5D3B9E]">
                Welcome to ChatGenius
              </CardTitle>
              <CardDescription>Sign in or create an account to get started.</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 text-sm text-red-500">
                  {decodeURIComponent(error)}
                </div>
              )}
              <div className="grid w-full items-center gap-4">
                <form action="/auth/sign-in/google" method="POST">
                  <Button 
                    className="w-full bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 hover:border-[#4A3B8C]/30 transition-colors" 
                    variant="outline" 
                    type="submit"
                  >
                    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                      <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                    </svg>
                    Continue with Google
                  </Button>
                </form>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-[#4A3B8C]/20" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>
                <form onSubmit={handleSignIn}>
                  <div className="flex flex-col space-y-4">
                    <div className="flex flex-col space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className="border-[#4A3B8C]/20 focus:border-[#4A3B8C] focus:ring-[#4A3B8C]"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="bg-[#4A3B8C] hover:bg-[#3A2E6E] transition-colors"
                    >
                      {isLoading ? 'Sending magic link...' : 'Continue with Email'}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
} 