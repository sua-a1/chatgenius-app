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
        setProfile(null)
        return null
      }

      if (!user) {
        console.log('No user found')
        setProfile(null)
        return null
      }

      console.log('Got user:', user.id)

      // Try to get existing profile
      const { data: profile, error } = await supabase
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
        throw error
      }

      console.log('Got existing profile:', profile)
      setProfile(profile)
      return profile
    } catch (error) {
      console.error('Error in refreshProfile:', error)
      return null
    }
  }

  const signOut = async () => {
    // Start sign-out process immediately
    const signOutPromise = supabase.auth.signOut()

    // Clear local state immediately
    setUser(null)
    setProfile(null)
    setIsInitialized(false)
    setInitAttempts(0)

    // Dispatch cleanup event and redirect immediately
    if (typeof window !== 'undefined') {
      // Use a custom event with a flag to indicate immediate cleanup
      const cleanupEvent = new CustomEvent('userSignOut', {
        detail: { immediate: true }
      })
      window.dispatchEvent(cleanupEvent)
    }

    // Redirect to landing page immediately
    router.push('/')

    try {
      // Wait for sign-out with a timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign-out timeout')), 2000)
      )
      
      await Promise.race([signOutPromise, timeoutPromise])
        .catch(error => {
          console.error('Sign-out process error:', error)
        })
    } catch (error) {
      console.error('Error during sign-out cleanup:', error)
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
            setIsLoading(false)
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
                  refreshProfile()
                }
              }, 1000)
            }
          } else {
            console.log('No session found')
            setUser(null)
            setProfile(null)
          }
          setIsInitialized(true)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error in initAuth:', error)
        if (mounted) {
          setIsLoading(false)
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
          const profile = await refreshProfile()
          if (!profile) {
            console.log('No profile after auth change, retrying...')
            initTimeout = setTimeout(() => {
              if (mounted) {
                refreshProfile()
              }
            }, 1000)
          }
        } else {
          setUser(null)
          setProfile(null)
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

    window.addEventListener('profileUpdated', handleProfileUpdate as EventListener)

    return () => {
      mounted = false
      if (initTimeout) {
        clearTimeout(initTimeout)
      }
      subscription.unsubscribe()
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener)
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