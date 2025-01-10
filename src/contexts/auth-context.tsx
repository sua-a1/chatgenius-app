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
        if (userError.message !== 'Auth session missing!') {
          console.error('Error getting user:', userError)
        }
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
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        if (error.code === 'PGRST116') {  // Record not found
          console.log('Creating new profile for user:', user.id)
          // Create new profile
          const { data: newProfile, error: createError } = await supabase
            .from('users')
            .insert([{
              id: user.id,
              email: user.email,
              username: user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`,
              notifications: { email: true, push: true },
              theme: 'light',
              updated_at: new Date().toISOString()
            }])
            .select()
            .single()

          if (createError) {
            console.error('Error creating profile:', createError)
            throw createError
          }
          console.log('Created new profile:', newProfile)
          setProfile(newProfile)
          return
        }
        throw error
      }

      console.log('Got existing profile:', profile)
      setProfile(profile)
    } catch (error) {
      console.error('Error in refreshProfile:', error)
      setProfile(null)
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
          if (sessionError.message !== 'Auth session missing!') {
            console.error('Error getting session:', sessionError)
          }
          return
        }

        if (mounted) {
          setUser(session?.user ?? null)
          if (session?.user) {
            await refreshProfile()
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message !== 'Auth session missing!') {
          console.error('Error in initAuth:', error)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
          setIsInitialized(true)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id)
      
      if (mounted) {
        setUser(session?.user ?? null)
        if (session?.user) {
          await refreshProfile()
        } else {
          setProfile(null)
          // Only redirect to sign in if we're initialized and it's not an initial session check
          if (isInitialized && event !== 'INITIAL_SESSION') {
            router.push('/auth/signin')
          }
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, refreshProfile, isLoading, isInitialized }}>
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