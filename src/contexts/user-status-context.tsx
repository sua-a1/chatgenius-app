'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth-context'
import { UserStatus } from '@/components/ui/avatar'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface UserPresence {
  user_id: string
  status: UserStatus
  last_seen: string
  updated_at: string
}

interface UserStatusContextType {
  userStatuses: Map<string, UserStatus>
  setUserStatus: (userId: string, status: UserStatus | 'auto') => Promise<void>
  updateMyStatus: (status: UserStatus | 'auto') => Promise<void>
  cleanup: () => Promise<void>
}

const UserStatusContext = createContext<UserStatusContextType | undefined>(undefined)

const PRESENCE_TIMEOUT = 10 * 60 * 1000 // 10 minutes
const ACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes for activity timeout
const AWAY_TIMEOUT = 5 * 60 * 1000 // 5 minutes before marking as away

export function UserStatusProvider({ children }: { children: React.ReactNode }) {
  const { profile, isInitialized } = useAuth()
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatus>>(new Map())
  const [autoMode, setAutoMode] = useState<Set<string>>(new Set())
  const [lastActivity, setLastActivity] = useState<Date>(new Date())
  const [isVisible, setIsVisible] = useState<boolean>(true)
  const [isStatusInitialized, setIsStatusInitialized] = useState(false)

  const cleanup = useCallback(async () => {
    if (!profile?.id) return

    console.log('Cleaning up user presence for:', profile.id)
    try {
      // Set status to offline with a timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Cleanup timed out')), 2000)
      })

      const cleanupPromise = supabase
        .from('user_presence')
        .upsert({
          user_id: profile.id,
          status: 'offline',
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      await Promise.race([cleanupPromise, timeoutPromise])
        .catch(error => {
          console.error('Cleanup error or timeout:', error)
        })

      // Clear local state immediately regardless of cleanup success
      setUserStatuses(new Map())
      setAutoMode(new Set())
      setIsStatusInitialized(false)
      console.log('User presence cleanup completed')
    } catch (error) {
      console.error('Error in cleanup:', error)
    }
  }, [profile?.id])

  // Add sign-out event listener
  useEffect(() => {
    const handleSignOut = async () => {
      console.log('Handling sign-out in UserStatusProvider')
      await cleanup()
    }

    window.addEventListener('userSignOut', handleSignOut)
    return () => {
      window.removeEventListener('userSignOut', handleSignOut)
    }
  }, [cleanup])

  // Initialize user's presence when they first log in
  useEffect(() => {
    const initializePresence = async () => {
      if (!isInitialized) {
        console.log('Auth not initialized yet, waiting...')
        return
      }

      if (!profile?.id) {
        console.log('No profile available, skipping presence initialization')
        return
      }

      if (isStatusInitialized) {
        console.log('Status already initialized')
        return
      }

      console.log('Initializing user presence for:', profile.id)
      try {
        // Set to auto mode by default
        setAutoMode(prev => new Set(prev).add(profile.id))
        
        // Set initial online status
        const now = new Date().toISOString()
        await supabase
          .from('user_presence')
          .upsert({
            user_id: profile.id,
            status: 'online',
            last_seen: now,
            updated_at: now
          }, {
            onConflict: 'user_id'
          })
        
        setIsStatusInitialized(true)
        console.log('User presence initialized')
      } catch (error) {
        console.error('Error initializing presence:', error)
      }
    }

    initializePresence()
  }, [profile?.id, isInitialized, isStatusInitialized])

  // Handle browser visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible'
      setIsVisible(visible)
      
      if (profile?.id) {
        const now = new Date().toISOString()
        // Update presence when tab becomes visible
        if (visible) {
          supabase
            .from('user_presence')
            .upsert({
              user_id: profile.id,
              status: 'online',
              last_seen: now,
              updated_at: now
            }, {
              onConflict: 'user_id'
            })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [profile?.id])

  // Update own presence regularly
  useEffect(() => {
    if (!profile?.id) return

    const updatePresence = async () => {
      const now = new Date().toISOString()
      await supabase
        .from('user_presence')
        .upsert({
          user_id: profile.id,
          status: 'online',
          last_seen: now,
          updated_at: now
        }, {
          onConflict: 'user_id'
        })
    }

    // Update presence immediately on mount
    updatePresence()

    // Update presence every 30 seconds
    const interval = setInterval(updatePresence, 30000)

    // Cleanup on unmount
    return () => {
      clearInterval(interval)
      // Don't call cleanup here as it might be a component unmount rather than a sign-out
    }
  }, [profile?.id])

  // Monitor user activity and update status
  useEffect(() => {
    if (!profile?.id) return

    const updateActivity = () => {
      setLastActivity(new Date())
      // If user was away/offline, set them back to online
      if (userStatuses.get(profile.id) !== 'online') {
        const now = new Date().toISOString()
        supabase
          .from('user_presence')
          .upsert({
            user_id: profile.id,
            status: 'online',
            last_seen: now,
            updated_at: now
          }, {
            onConflict: 'user_id'
          })
      }
    }

    // Track various user activities
    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('keydown', updateActivity)
    window.addEventListener('mousedown', updateActivity)
    window.addEventListener('touchstart', updateActivity)
    window.addEventListener('scroll', updateActivity)

    return () => {
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('keydown', updateActivity)
      window.removeEventListener('mousedown', updateActivity)
      window.removeEventListener('touchstart', updateActivity)
      window.removeEventListener('scroll', updateActivity)
    }
  }, [profile?.id])

  // Load initial statuses and subscribe to changes
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const { data: presenceData, error } = await supabase
          .from('user_presence')
          .select('user_id, status, last_seen')

        if (error) {
          console.error('Error loading presence data:', error)
          return
        }

        if (presenceData) {
          const newStatuses = new Map<string, UserStatus>()
          presenceData.forEach(presence => {
            const lastSeen = new Date(presence.last_seen)
            const now = new Date()
            // If last seen is more than PRESENCE_TIMEOUT ago, mark as offline
            if (now.getTime() - lastSeen.getTime() > PRESENCE_TIMEOUT) {
              newStatuses.set(presence.user_id, 'offline')
            } else {
              newStatuses.set(presence.user_id, presence.status as UserStatus)
            }
          })
          setUserStatuses(newStatuses)
        }
      } catch (error) {
        console.error('Error in loadStatuses:', error)
      }
    }

    loadStatuses()

    // Subscribe to presence changes
    const channel = supabase.channel('user_presence_changes')
    
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        (payload: RealtimePostgresChangesPayload<UserPresence>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newPresence = payload.new
            setUserStatuses(prev => {
              const newStatuses = new Map(prev)
              newStatuses.set(newPresence.user_id, newPresence.status)
              return newStatuses
            })
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  const setUserStatus = async (userId: string, status: UserStatus | 'auto') => {
    console.log('Setting user status:', { userId, status })
    
    if (status === 'auto') {
      setAutoMode(prev => {
        const newAutoMode = new Set(prev)
        newAutoMode.add(userId)
        return newAutoMode
      })
      // When switching to auto mode, set initial status as online
      status = 'online'
    } else {
      setAutoMode(prev => {
        const newAutoMode = new Set(prev)
        newAutoMode.delete(userId)
        return newAutoMode
      })
    }

    const now = new Date().toISOString()
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: userId,
          status,
          last_seen: now,
          updated_at: now
        }, {
          onConflict: 'user_id'
        })
      
      if (error) {
        console.error('Error updating user status:', error)
        throw error
      }
      
      console.log('Status update successful:', data)
    } catch (error) {
      console.error('Failed to update user status:', error)
      throw error
    }
  }

  const updateMyStatus = async (status: UserStatus | 'auto') => {
    if (!profile?.id) return
    await setUserStatus(profile.id, status)
  }

  const contextValue = { userStatuses, setUserStatus, updateMyStatus, cleanup }
  console.log('UserStatusProvider context value:', {
    statusesCount: userStatuses.size,
    statuses: Object.fromEntries(userStatuses)
  })

  return (
    <UserStatusContext.Provider value={contextValue}>
      {children}
    </UserStatusContext.Provider>
  )
}

export function useUserStatus() {
  const context = useContext(UserStatusContext)
  if (context === undefined) {
    throw new Error('useUserStatus must be used within a UserStatusProvider')
  }
  return context
} 