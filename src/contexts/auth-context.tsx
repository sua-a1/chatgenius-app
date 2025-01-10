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
  refreshProfile: () => Promise<void>
  isLoading: boolean
  isInitialized: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  refreshProfile: async () => {},
  isLoading: true,
  isInitialized: false
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const supabase = createClientComponentClient()
  const router = useRouter()

  const refreshProfile = async () => {
    try {
      console.log('Refreshing profile...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('Error getting user:', userError)
        setProfile(null)
        return
      }

      if (!user) {
        console.log('No user found')
        setProfile(null)
        return
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
    } catch (error) {
      console.error('Error in refreshProfile:', error)
    }
  }

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        console.log('Initializing auth...')
        setIsLoading(true)

        // First try to get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Error getting session:', sessionError)
          return
        }

        if (session?.user) {
          setUser(session.user)
          await refreshProfile()
        }

        setIsInitialized(true)
        setIsLoading(false)
      } catch (error) {
        console.error('Error in initAuth:', error)
        setIsLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id)
      
      if (mounted) {
        if (session?.user) {
          setUser(session.user)
          await refreshProfile()
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
      subscription.unsubscribe()
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener)
    }
  }, [])

  const contextValue = {
    user,
    profile,
    refreshProfile,
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