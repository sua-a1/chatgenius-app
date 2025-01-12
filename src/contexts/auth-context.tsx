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
  const supabase = createClientComponentClient()
  const router = useRouter()

  // Create signOutEvent only if window is available
  const signOutEvent = typeof window !== 'undefined' 
    ? new Event('userSignOut') 
    : null

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
    // Clear local state immediately
    setUser(null)
    setProfile(null)
    setIsInitialized(false)
    setInitAttempts(0)

    // Dispatch cleanup event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('userSignOut', { detail: { immediate: true } }))
    }

    // Redirect immediately - don't wait for sign-out
    router.push('/')

    // Attempt Supabase sign-out in background
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject('timeout'), 1000))
      ])
    } catch (error) {
      console.error('Sign-out process error:', error)
      // Continue even if sign-out fails
    }

    return Promise.resolve()
  }

  useEffect(() => {
    let mounted = true
    let initTimeout: NodeJS.Timeout | null = null

    const initAuth = async () => {
      try {
        console.log('Initializing auth...')
        setIsLoading(true)

        // Get session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Error getting session:', sessionError)
          if (mounted) {
            // Don't change state on error, just finish loading
            setIsLoading(false)
            setIsInitialized(true)
          }
          return
        }

        if (mounted) {
          if (session?.user) {
            console.log('Session found, setting user:', session.user.id)
            setUser(session.user)
            const profile = await refreshProfile()
            if (!profile) {
              console.log('No profile found, will retry in background')
              // Retry profile load in background
              initTimeout = setTimeout(() => {
                if (mounted) {
                  refreshProfile().catch(console.error)
                }
              }, 1000)
            }
          } else {
            console.log('No session found')
            // Only clear user state, keep other states if they exist
            setUser(null)
          }
          setIsInitialized(true)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error in initAuth:', error)
        if (mounted) {
          // Don't change state on error, just finish loading
          setIsLoading(false)
          setIsInitialized(true)
        }
      }
    }

    // Always try to initialize
    if (!isInitialized) {
      initAuth()
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id)
      
      if (mounted) {
        if (session?.user) {
          setUser(session.user)
          refreshProfile().catch(console.error) // Continue even if profile refresh fails
        } else {
          setUser(null)
          // Keep profile data in case of temporary error
        }
        setIsInitialized(true)
      }
    })

    // Listen for profile updates
    const handleProfileUpdate = (event: CustomEvent<UserProfile>) => {
      console.log('Profile update event received:', event.detail)
      if (mounted && event.detail) {
        setProfile(event.detail)
      }
    }

    // Listen for sign-out events
    const handleSignOut = (event: CustomEvent<{ skipInit?: boolean }>) => {
      if (event.detail?.skipInit) {
        // If skipInit is true, prevent re-initialization by keeping isInitialized true
        setIsInitialized(true)
      } else {
        // Otherwise reset initialization state
        setIsInitialized(false)
      }
      setUser(null)
      setProfile(null)
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