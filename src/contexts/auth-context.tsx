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
    // Dispatch sign-out event if available
    if (signOutEvent) {
      window.dispatchEvent(signOutEvent)
    }

    // Clear local state immediately
    setUser(null)
    setProfile(null)
    setIsInitialized(false)

    // Start sign-out process in background
    supabase.auth.signOut()
      .catch(error => {
        console.error('Error during sign-out:', error)
      })

    // Redirect immediately
    router.push('/auth/signin')
  }

  useEffect(() => {
    let mounted = true
    let initTimeout: NodeJS.Timeout
    let retryTimeout: NodeJS.Timeout

    const initAuth = async () => {
      try {
        console.log('Initializing auth... (attempt', initAttempts + 1, ')')
        setIsLoading(true)

        // Set a timeout to prevent hanging
        initTimeout = setTimeout(() => {
          if (mounted && !isInitialized) {
            console.log('Auth initialization timed out, retrying...')
            setInitAttempts(prev => prev + 1)
          }
        }, 5000) // 5 second timeout

        // First try to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Error getting session:', sessionError)
          if (mounted) {
            setIsInitialized(true)
            setIsLoading(false)
          }
          return
        }

        if (session?.user) {
          if (mounted) {
            setUser(session.user)
            const profile = await refreshProfile()
            if (!profile) {
              console.error('Failed to load profile during initialization')
              // Retry profile load after a short delay
              retryTimeout = setTimeout(() => {
                if (mounted && !profile) {
                  console.log('Retrying profile load...')
                  refreshProfile()
                }
              }, 2000)
            }
          }
        }

        if (mounted) {
          setIsInitialized(true)
          setIsLoading(false)
          clearTimeout(initTimeout)
        }
      } catch (error) {
        console.error('Error in initAuth:', error)
        if (mounted) {
          setIsInitialized(true)
          setIsLoading(false)
        }
      }
    }

    // Only attempt initialization 3 times
    if (initAttempts < 3 && !isInitialized) {
      initAuth()
    } else if (initAttempts >= 3 && !isInitialized) {
      console.error('Failed to initialize auth after 3 attempts')
      if (mounted) {
        setIsInitialized(true)
        setIsLoading(false)
      }
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id)
      
      if (mounted) {
        if (session?.user) {
          setUser(session.user)
          const profile = await refreshProfile()
          if (!profile) {
            console.error('Failed to load profile after auth state change')
            // Retry profile load after a short delay
            retryTimeout = setTimeout(() => {
              if (mounted && !profile) {
                console.log('Retrying profile load after auth change...')
                refreshProfile()
              }
            }, 2000)
          }
        } else {
          setUser(null)
          setProfile(null)
        }
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
      clearTimeout(initTimeout)
      clearTimeout(retryTimeout)
      subscription.unsubscribe()
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener)
    }
  }, [initAttempts, isInitialized])

  const contextValue = {
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