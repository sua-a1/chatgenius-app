'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/auth-helpers-nextjs'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export interface UserProfile {
  id: string
  username: string
  email: string
  avatar_url: string | null
  full_name: string | null
  notifications: {
    email: boolean
    push: boolean
  }
  theme: 'light' | 'dark'
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  refreshProfile: () => Promise<UserProfile | null>
  signOut: () => Promise<void>
  isLoading: boolean
  isInitialized: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  refreshProfile: async () => null,
  signOut: async () => {},
  isLoading: true,
  isInitialized: false
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [initAttempts, setInitAttempts] = useState(0)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const supabase = createClientComponentClient()
  const router = useRouter()

  // Reset function to clear state
  const resetState = () => {
    setUser(null)
    setProfile(null)
    setIsInitialized(false)
    setInitAttempts(0)
    setIsSigningOut(false)
  }

  const refreshProfile = async () => {
    try {
      // Skip profile refresh if signing out
      if (isSigningOut) {
        console.log('Skipping profile refresh during sign-out')
        return null
      }

      // Skip profile refresh if on public pages
      if (typeof window !== 'undefined') {
        const isPublicPage = [
          '/',
          '/auth/sign-in',
          '/auth/sign-out',
          '/auth/callback',
          '/auth/verify'
        ].includes(window.location.pathname)
        
        if (isPublicPage) {
          console.log('Skipping profile refresh on public page')
          return null
        }
      }

      console.log('Refreshing profile...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        if (userError.message.includes('Auth session missing')) {
          // This is expected when not authenticated
          return null
        }
        console.error('Error getting user:', userError)
        return null
      }

      if (!user) {
        console.log('No user found')
        return null
      }

      console.log('Got user:', user.id)

      // Try to get existing profile
      const { data: newProfile, error } = await supabase
        .from('users')
        .select(`
          id,
          username,
          email,
          avatar_url,
          full_name,
          notifications,
          theme,
          created_at,
          updated_at
        `)
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      console.log('Got existing profile:', newProfile)
      setProfile(newProfile)
      return newProfile
    } catch (error) {
      console.error('Error in refreshProfile:', error)
      return null
    }
  }

  const signOut = async () => {
    // Set flag to prevent profile refresh during sign-out
    setIsSigningOut(true)

    try {
      // Attempt Supabase sign-out first, before clearing state
      try {
        const signOutPromise = supabase.auth.signOut({ scope: 'global' })
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sign-out timed out')), 5000)
        )

        await Promise.race([signOutPromise, timeoutPromise])
          .catch((error: Error | unknown) => {
            // Log but continue with cleanup
            console.log('Sign-out status:', error instanceof Error ? error.message : error)
          })
      } catch (error: unknown) {
        // Log but continue with cleanup
        console.log('Sign-out status:', error instanceof Error ? error.message : error)
      }

      // Now clear local state
      resetState()

      // Dispatch cleanup event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('userSignOut', { detail: { immediate: true, skipInit: true } }))
      }

      // Clear any remaining auth data from localStorage
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('supabase.auth.token')
        window.localStorage.removeItem('supabase.auth.expires_at')
        window.localStorage.removeItem('supabase.auth.refresh_token')
      }

      // Force a hard redirect to root path and let middleware handle the rest
      window.location.href = '/'
    } catch (error) {
      console.error('Sign-out error:', error)
      // Still clear state and redirect on error
      resetState()
      window.location.href = '/'
    }

    return Promise.resolve()
  }

  useEffect(() => {
    let mounted = true
    let initTimeout: NodeJS.Timeout | null = null
    let retryTimeout: NodeJS.Timeout | null = null

    // Initialize auth state
    const initAuth = async () => {
      if (!mounted || isInitialized || isInitializing || isSigningOut) return

      try {
        setIsInitializing(true)
        console.log('Initializing auth...')

        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          if (mounted) {
            setIsInitialized(true)
            setIsLoading(false)
            setIsInitializing(false)
          }
          return
        }

        if (session?.user && mounted && !isSigningOut) {
          setUser(session.user)
          
          // Only refresh profile if not on public page
          const isPublicPage = [
            '/',
            '/auth/sign-in',
            '/auth/sign-out',
            '/auth/callback',
            '/auth/verify'
          ].includes(window.location.pathname)

          if (!isPublicPage) {
            const profileResult = await refreshProfile()
            
            // If profile fetch fails, retry after a delay
            if (!profileResult && mounted && initAttempts < 3 && !isSigningOut) {
              console.log('Profile fetch failed, retrying...')
              setInitAttempts(prev => prev + 1)
              setIsInitializing(false)
              retryTimeout = setTimeout(() => {
                setIsInitialized(false) // Force re-initialization
              }, 2000)
              return
            }
          }
        }

        if (mounted) {
          setIsInitialized(true)
          setIsLoading(false)
          setIsInitializing(false)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          setIsInitialized(true)
          setIsLoading(false)
          setIsInitializing(false)
        }
      }
    }

    // Only initialize on mount or when forced
    if (!isInitialized && !isInitializing && !isSigningOut) {
      initAuth()
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted || isSigningOut) return

      console.log('Auth state changed:', event, session?.user?.id)
      
      if (event === 'SIGNED_OUT') {
        resetState()
        setIsLoading(false)
        return
      }

      // For initial session and sign in, update user without re-initializing
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
          setUser(session.user)
          
          // Only dispatch sign-in event for actual sign-ins
          if (event === 'SIGNED_IN') {
            window.dispatchEvent(new CustomEvent('userSignedIn', { detail: { userId: session.user.id } }))
          }

          // Only refresh profile if not on public page
          const isPublicPage = [
            '/',
            '/auth/sign-in',
            '/auth/sign-out',
            '/auth/callback',
            '/auth/verify'
          ].includes(window.location.pathname)

          if (!isPublicPage && !isInitializing) {
            refreshProfile().then(() => {
              if (mounted) {
                setIsInitialized(true)
                setIsLoading(false)
              }
            })
          } else {
            setIsInitialized(true)
            setIsLoading(false)
          }
        }
      } else {
        // For other events, just update the user state
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    })

    // Listen for profile updates
    const handleProfileUpdate = (event: CustomEvent<UserProfile>) => {
      if (mounted && event.detail) {
        setProfile(event.detail)
      }
    }

    // Listen for sign-out events
    const handleSignOut = (event: CustomEvent<{ skipInit?: boolean }>) => {
      if (event.detail?.skipInit) {
        setIsInitialized(true)
      } else {
        setIsInitialized(false)
      }
      resetState()
    }

    window.addEventListener('profileUpdated', handleProfileUpdate as EventListener)
    window.addEventListener('userSignOut', handleSignOut as EventListener)

    return () => {
      mounted = false
      if (initTimeout) clearTimeout(initTimeout)
      if (retryTimeout) clearTimeout(retryTimeout)
      subscription.unsubscribe()
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener)
      window.removeEventListener('userSignOut', handleSignOut as EventListener)
    }
  }, [isInitialized, initAttempts, isSigningOut])

  const contextValue: AuthContextType = {
    user,
    profile,
    refreshProfile,
    signOut,
    isLoading,
    isInitialized,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 