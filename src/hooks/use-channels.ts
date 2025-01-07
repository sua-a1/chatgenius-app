'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Channel } from '@/types'
import { useToast } from './use-toast'

export function useChannels(workspaceId: string | undefined) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (workspaceId && profile?.id) {
      console.log('Loading channels for workspace:', workspaceId)
      loadChannels()
    } else {
      console.log('No workspace ID or profile available')
      setChannels([])
    }
  }, [workspaceId, profile?.id])

  const loadChannels = async () => {
    try {
      setIsLoading(true)
      console.log('Starting to load channels...')

      // Get channels where user is either a member or the workspace member
      const { data, error } = await supabase
        .from('channels')
        .select(`
          *,
          channel_memberships (
            user_id,
            role
          )
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading channels:', error)
        throw error
      }

      // Filter channels where user is a member or the workspace is public
      const filteredChannels = data.filter(channel => {
        const isMember = channel.channel_memberships.some(
          (membership: any) => membership.user_id === profile!.id
        )
        return isMember || !channel.is_private
      })

      // Extract just the channel data
      const channels = filteredChannels.map(item => ({
        id: item.id,
        workspace_id: item.workspace_id,
        name: item.name,
        topic: item.topic,
        is_private: item.is_private,
        created_by: item.created_by,
        created_at: item.created_at,
        updated_at: item.updated_at
      }))

      console.log('Loaded channels:', channels)
      setChannels(channels)
    } catch (error) {
      console.error('Error loading channels:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading channels',
        description: error instanceof Error ? error.message : 'Please try again later.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createChannel = async (name: string, isPrivate: boolean = false, topic: string = '') => {
    if (!profile?.id || !workspaceId) return null

    try {
      // Create the channel
      const { data: channel, error: channelError } = await supabase
        .from('channels')
        .insert([{
          workspace_id: workspaceId,
          name,
          topic,
          is_private: isPrivate,
          created_by: profile.id
        }])
        .select(`
          id,
          workspace_id,
          name,
          topic,
          is_private,
          created_by,
          created_at,
          updated_at
        `)
        .single()

      if (channelError) {
        console.error('Error creating channel:', channelError)
        throw channelError
      }

      // Add the creator as an admin member
      const { error: membershipError } = await supabase
        .from('channel_memberships')
        .insert([{
          channel_id: channel.id,
          user_id: profile.id,
          role: 'admin'
        }])

      if (membershipError) {
        console.error('Error creating channel membership:', membershipError)
        // If membership creation fails, delete the channel
        await supabase
          .from('channels')
          .delete()
          .eq('id', channel.id)
        throw membershipError
      }

      const formattedChannel = {
        ...channel,
        name: channel.name
      }

      setChannels(prev => [...prev, formattedChannel])
      return formattedChannel
    } catch (error) {
      console.error('Error creating channel:', error)
      toast({
        variant: 'destructive',
        title: 'Error creating channel',
        description: error instanceof Error ? error.message : 'Please try again later.',
      })
      return null
    }
  }

  const updateChannel = async (id: string, { name, topic }: { name?: string; topic?: string }) => {
    try {
      const updates: any = {
        updated_at: new Date().toISOString(),
      }
      if (name !== undefined) updates.name = name
      if (topic !== undefined) updates.topic = topic

      const { data, error } = await supabase
        .from('channels')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setChannels(prev => 
        prev.map(c => c.id === id ? data : c)
      )
      return data
    } catch (error) {
      console.error('Error updating channel:', error)
      toast({
        variant: 'destructive',
        title: 'Error updating channel',
        description: 'Please try again later.',
      })
      return null
    }
  }

  const deleteChannel = async (id: string) => {
    try {
      // Delete channel memberships first (due to foreign key constraint)
      const { error: membershipError } = await supabase
        .from('channel_memberships')
        .delete()
        .eq('channel_id', id)

      if (membershipError) throw membershipError

      // Then delete the channel
      const { error: channelError } = await supabase
        .from('channels')
        .delete()
        .eq('id', id)

      if (channelError) throw channelError

      setChannels(prev => prev.filter(c => c.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting channel:', error)
      toast({
        variant: 'destructive',
        title: 'Error deleting channel',
        description: 'Please try again later.',
      })
      return false
    }
  }

  return {
    channels,
    isLoading,
    createChannel,
    updateChannel,
    deleteChannel,
    refreshChannels: loadChannels,
  }
} 