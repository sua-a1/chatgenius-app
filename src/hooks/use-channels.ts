'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { Channel } from '@/types'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface ChannelPayload {
  id: string
  workspace_id: string
  name: string
  created_at: string
  updated_at: string
  created_by: string
  is_private: boolean
  topic: string | null
}

interface ChannelMembershipPayload {
  channel_id: string
  user_id: string
  role: string
}

const supabase = createClientComponentClient()

export function useChannels(workspaceId: string | undefined) {
  const { profile, isInitialized } = useAuth()
  const { toast } = useToast()
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadChannels = async () => {
    if (!workspaceId || !profile?.id) {
      setChannels([])
      setIsLoading(false)
      return
    }

    try {
      console.log('[DEBUG] Loading channels for workspace:', workspaceId)
      
      // Get all channels in the workspace and user's memberships in one query
      const { data: channelsData, error: channelsError } = await supabase
        .from('channels')
        .select(`
          *,
          memberships:channel_memberships!left (
            user_id
          )
        `)
        .eq('workspace_id', workspaceId)

      if (channelsError) throw channelsError

      // Filter channels based on access rules:
      // 1. User is a member
      // 2. Channel is public
      const accessibleChannels = channelsData
        .filter(channel => 
          channel.memberships.some((m: any) => m?.user_id === profile.id) || 
          !channel.is_private
        )
        .map(channel => ({
          id: channel.id,
          workspace_id: channel.workspace_id,
          name: channel.name,
          topic: channel.topic,
          is_private: channel.is_private,
          created_by: channel.created_by,
          created_at: channel.created_at,
          updated_at: channel.updated_at
        }))

      console.log('[DEBUG] Loaded channels:', accessibleChannels)
      setChannels(accessibleChannels)
    } catch (error) {
      console.error('Error loading channels:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading channels',
        description: 'Failed to load channels. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isInitialized) {
      console.log('[DEBUG] Channels: Auth not initialized yet')
      return
    }

    if (!workspaceId || !profile?.id) {
      console.log('[DEBUG] Channels: No workspace ID or profile available')
      setChannels([])
      setIsLoading(false)
      return
    }

    console.log('[DEBUG] Setting up channel subscriptions for workspace:', workspaceId)
    loadChannels()

    // Set up realtime subscriptions for channel changes
    const channelsChannel = supabase
      .channel(`channels:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'channels',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload: RealtimePostgresChangesPayload<ChannelPayload>) => {
          console.log('[DEBUG] Channel deleted:', payload)
          if (payload.eventType === 'DELETE' && payload.old) {
            // Immediately update local state
            setChannels(prev => {
              const updated = prev.filter(c => c.id !== payload.old.id)
              console.log('[DEBUG] Channels after deletion:', updated)
              return updated
            })

            // Show toast
            toast({
              title: 'Channel deleted',
              description: 'The channel has been deleted.',
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_memberships',
          filter: `user_id=eq.${profile.id}`,
        },
        async () => {
          console.log('[DEBUG] Channel membership changed, reloading channels')
          await loadChannels()
        }
      )
      .subscribe()

    return () => {
      console.log('[DEBUG] Cleaning up channel subscriptions')
      channelsChannel.unsubscribe()
    }
  }, [workspaceId, profile?.id, isInitialized, toast])

  return {
    channels,
    isLoading,
    loadChannels,
    createChannel: async (name: string) => {
      if (!workspaceId || !profile?.id) {
        toast({
          variant: 'destructive',
          title: 'Error creating channel',
          description: 'Please select a workspace first.',
        })
        return null
      }

      try {
        // Create the channel
        const { data: channel, error: channelError } = await supabase
          .from('channels')
          .insert([{
            workspace_id: workspaceId,
            name: name,
            created_by: profile.id,
            is_private: false,
            topic: null
          }])
          .select()
          .single()

        if (channelError) throw channelError

        // Add creator as channel member
        const { error: membershipError } = await supabase
          .from('channel_memberships')
          .insert([{
            channel_id: channel.id,
            user_id: profile.id,
            role: 'admin'
          }])

        if (membershipError) throw membershipError

        // Update local state
        setChannels(prev => [...prev, channel])
        return channel
      } catch (error) {
        console.error('Error creating channel:', error)
        toast({
          variant: 'destructive',
          title: 'Error creating channel',
          description: 'Failed to create channel. Please try again.',
        })
        return null
      }
    },
    deleteChannel: async (channelId: string) => {
      if (!workspaceId || !profile?.id) {
        toast({
          variant: 'destructive',
          title: 'Error deleting channel',
          description: 'Please select a workspace first.',
        })
        return false
      }

      try {
        // Delete the channel
        const { error } = await supabase
          .from('channels')
          .delete()
          .eq('id', channelId)
          .eq('workspace_id', workspaceId)

        if (error) throw error

        // Update local state
        setChannels(prev => prev.filter(c => c.id !== channelId))
        
        toast({
          title: 'Channel deleted',
          description: 'The channel has been deleted successfully.',
        })

        // Force reload to ensure consistency
        window.location.reload()
        return true
      } catch (error) {
        console.error('Error deleting channel:', error)
        toast({
          variant: 'destructive',
          title: 'Error deleting channel',
          description: 'Failed to delete channel. Please try again.',
        })
        return false
      }
    },
  } as const
}

export type UseChannelsReturn = {
  channels: Channel[]
  isLoading: boolean
  loadChannels: () => Promise<void>
  createChannel: (name: string) => Promise<Channel | null>
  deleteChannel: (channelId: string) => Promise<boolean>
} 