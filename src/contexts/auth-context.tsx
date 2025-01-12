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
      console.log('Refreshing profile...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('Error getting user:', userError)
        // Don't clear profile on error to prevent cascading updates
        return profile
      }

      if (!user) {
        console.log('No user found')
        // Don't clear profile on error to prevent cascading updates
        return profile
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
        // Return existing profile on error
        return profile
      }

      console.log('Got existing profile:', newProfile)
      setProfile(newProfile)
      return newProfile
    } catch (error) {
      console.error('Error in refreshProfile:', error)
      // Return existing profile on error
      return profile
    }
  }

  const signOut = async () => {
    // Set flag to prevent profile refresh during sign-out
    setIsSigningOut(true)

    try {
      // Clear local state first
      resetState()

      // Dispatch cleanup event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('userSignOut', { detail: { immediate: true, skipInit: true } }))
      }

      // Clear any remaining auth data from localStorage first
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('supabase.auth.token')
        window.localStorage.removeItem('supabase.auth.expires_at')
        window.localStorage.removeItem('supabase.auth.refresh_token')
      }

      // Attempt Supabase sign-out with a longer timeout
      try {
        const signOutPromise = supabase.auth.signOut({ scope: 'global' })
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sign-out timed out, but session data was cleared')), 5000)
        )

        await Promise.race([signOutPromise, timeoutPromise])
          .catch((error: Error | unknown) => {
            // Log but don't throw - we've already cleared local state
            console.log('Sign-out completed with status:', error instanceof Error ? error.message : error)
          })
      } catch (error: unknown) {
        // Log but don't throw - we've already cleared local state
        console.log('Sign-out completed with status:', error instanceof Error ? error.message : error)
      }

      // Redirect after cleanup
      router.push('/')
    } catch (error) {
      console.error('Sign-out error:', error)
      // Ensure redirect happens even on error
      router.push('/')
    }

    return Promise.resolve()
  }

  useEffect(() => {
    let mounted = true
    let initTimeout: NodeJS.Timeout | null = null

    // Initialize auth state
    const initAuth = async () => {
      if (!mounted || isInitialized) return

      try {
        setIsLoading(true)
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          if (mounted) {
            setIsInitialized(true)
            setIsLoading(false)
          }
          return
        }

        if (session?.user && mounted) {
          setUser(session.user)
          await refreshProfile().catch(console.error)
        }

        if (mounted) {
          setIsInitialized(true)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          setIsInitialized(true)
          setIsLoading(false)
        }
      }
    }

    // Always try to initialize if not initialized
    if (!isInitialized) {
      initAuth()
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id)
      
      if (!mounted) return

      setIsLoading(true)
      
      // Reset state on sign out
      if (event === 'SIGNED_OUT') {
        resetState()
        setIsLoading(false)
        return
      }

      // Handle sign in and other auth events
      if (session?.user) {
        setUser(session.user)
        if (!isSigningOut) {
          try {
            await refreshProfile()
          } catch (error) {
            console.error('Error refreshing profile:', error)
          }
        }
      } else {
        setUser(null)
      }

      setIsInitialized(true)
      setIsLoading(false)
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
      if (initTimeout) {
        clearTimeout(initTimeout)
      }
      subscription.unsubscribe()
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener)
      window.removeEventListener('userSignOut', handleSignOut as EventListener)
    }
  }, [isInitialized])

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