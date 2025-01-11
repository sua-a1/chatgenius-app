'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
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
}

const UserStatusContext = createContext<UserStatusContextType | undefined>(undefined)

const PRESENCE_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const ACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes for activity timeout
const AWAY_TIMEOUT = 5 * 60 * 1000 // 5 minutes before marking as away

export function UserStatusProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatus>>(new Map())
  const [autoMode, setAutoMode] = useState<Set<string>>(new Set())
  const [lastActivity, setLastActivity] = useState<Date>(new Date())
  const [isVisible, setIsVisible] = useState<boolean>(true)

  // Handle browser visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible'
      setIsVisible(visible)
      
      if (profile?.id && autoMode.has(profile.id)) {
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
  }, [profile?.id, autoMode])

  // Monitor user activity
  useEffect(() => {
    const updateActivity = () => {
      setLastActivity(new Date())
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
  }, [])

  // Update status based on activity and visibility
  useEffect(() => {
    if (!profile?.id || !autoMode.has(profile.id)) return

    const checkActivity = setInterval(async () => {
      const now = new Date()
      const timeSinceActivity = now.getTime() - lastActivity.getTime()

      if (autoMode.has(profile.id)) {
        let newStatus: UserStatus = 'online'
        
        // If tab is not visible for AWAY_TIMEOUT, mark as away
        if (!isVisible && timeSinceActivity > AWAY_TIMEOUT) {
          newStatus = 'away'
        }
        // If no activity for ACTIVITY_TIMEOUT, mark as away
        else if (timeSinceActivity > ACTIVITY_TIMEOUT) {
          newStatus = 'away'
        }

        // Only update if status has changed
        if (newStatus !== userStatuses.get(profile.id)) {
          const nowISO = now.toISOString()
          await supabase
            .from('user_presence')
            .upsert({
              user_id: profile.id,
              status: newStatus,
              last_seen: nowISO,
              updated_at: nowISO
            }, {
              onConflict: 'user_id'
            })
        }
      }
    }, 30000) // Check every 30 seconds

    return () => {
      clearInterval(checkActivity)
    }
  }, [profile?.id, autoMode, lastActivity, isVisible])

  // Load initial statuses and subscribe to changes
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        console.log('Attempting to load presence data...')
        const { data: presenceData, error } = await supabase
          .from('user_presence')
          .select('user_id, status, last_seen')

        if (error) {
          console.error('Error loading presence data:', error)
          return
        }

        console.log('Loading initial presence data:', presenceData)

        if (presenceData) {
          const newStatuses = new Map<string, UserStatus>()
          presenceData.forEach(presence => {
            const lastSeen = new Date(presence.last_seen)
            const now = new Date()
            // If last seen is more than 5 minutes ago, mark as offline
            if (now.getTime() - lastSeen.getTime() > PRESENCE_TIMEOUT) {
              newStatuses.set(presence.user_id, 'offline')
            } else {
              newStatuses.set(presence.user_id, presence.status as UserStatus)
            }
          })
          console.log('Setting initial statuses:', Object.fromEntries(newStatuses))
          setUserStatuses(newStatuses)
        }
      } catch (error) {
        console.error('Error in loadStatuses:', error)
      }
    }

    loadStatuses()

    // Subscribe to presence changes
    console.log('Setting up realtime subscription...')
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
          console.log('Received presence update:', payload)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newPresence = payload.new
            setUserStatuses(prev => {
              const newStatuses = new Map(prev)
              newStatuses.set(newPresence.user_id, newPresence.status)
              console.log('Updated statuses:', Object.fromEntries(newStatuses))
              return newStatuses
            })
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    return () => {
      console.log('Cleaning up realtime subscription...')
      channel.unsubscribe()
    }
  }, [])

  // Update own presence regularly
  useEffect(() => {
    if (!profile?.id) return

    const updatePresence = async () => {
      const now = new Date().toISOString()
      console.log('Updating own presence:', {
        userId: profile.id,
        status: userStatuses.get(profile.id) || 'online'
      })
      await supabase
        .from('user_presence')
        .upsert({
          user_id: profile.id,
          status: userStatuses.get(profile.id) || 'online',
          last_seen: now,
          updated_at: now
        }, {
          onConflict: 'user_id'
        })
    }

    // Update presence immediately
    updatePresence()

    // Update presence every minute
    const interval = setInterval(updatePresence, 60000)

    // Mark users as offline if they haven't updated presence
    const checkOffline = setInterval(async () => {
      const now = new Date()
      for (const [userId, status] of userStatuses.entries()) {
        if (status === 'online') {
          const { data: presence } = await supabase
            .from('user_presence')
            .select('last_seen')
            .eq('user_id', userId)
            .single()

          if (presence && new Date(presence.last_seen).getTime() - now.getTime() > PRESENCE_TIMEOUT) {
            setUserStatuses(prev => {
              const newStatuses = new Map(prev)
              newStatuses.set(userId, 'offline')
              return newStatuses
            })
          }
        }
      }
    }, 60000)

    return () => {
      clearInterval(interval)
      clearInterval(checkOffline)
    }
  }, [profile?.id])

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

  const contextValue = { userStatuses, setUserStatus, updateMyStatus }
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