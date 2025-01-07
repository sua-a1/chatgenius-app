'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Channel, User } from '@/types'
import { useToast } from './use-toast'

interface ChannelMember {
  id: string
  email: string
  username: string
  avatar_url: string | null
  role: string
}

interface WorkspaceMember {
  id: string
  email: string
  username: string
  avatar_url: string | null
  role: string
}

interface DatabaseChannelMember {
  user_id: string
  role: string
  users: {
    id: string
    email: string
    username: string
    avatar_url: string | null
  }
}

interface DatabaseWorkspaceMember {
  user_id: string
  role: string
  users: {
    id: string
    email: string
    username: string
    avatar_url: string | null
  }
}

export function useChannelManagement(workspaceId: string | undefined, channels: Channel[] = []) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([])
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([])
  const [isLoadingChannel, setIsLoadingChannel] = useState(true)
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true)

  // Check if current user is admin
  useEffect(() => {
    if (workspaceId && profile?.id) {
      checkAdminStatus()
      loadWorkspaceMembers()
    }
  }, [workspaceId, profile?.id])

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('workspace_memberships')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', profile!.id)
        .single()

      if (error) throw error
      setIsAdmin(data.role === 'admin' || data.role === 'owner')
    } catch (error) {
      console.error('Error checking admin status:', error)
      setIsAdmin(false)
    }
  }

  const loadWorkspaceMembers = async () => {
    try {
      setIsLoadingWorkspace(true)
      const { data: rawData, error } = await supabase
        .from('workspace_memberships')
        .select(`
          user_id,
          role,
          users (
            id,
            email,
            username,
            avatar_url
          )
        `)
        .eq('workspace_id', workspaceId)

      if (error) throw error

      // Safely cast the data
      const data = rawData as unknown as DatabaseWorkspaceMember[]
      const members = data.map(item => ({
        id: item.users.id,
        email: item.users.email,
        username: item.users.username,
        avatar_url: item.users.avatar_url,
        role: item.role
      }))

      setWorkspaceMembers(members)
    } catch (error) {
      console.error('Error loading workspace members:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading workspace members',
        description: 'Could not load workspace members. Please try again.',
      })
    } finally {
      setIsLoadingWorkspace(false)
    }
  }

  const loadChannelMembers = async (channelId: string) => {
    try {
      setIsLoadingChannel(true)
      setSelectedChannel(channels.find(c => c.id === channelId) || null)
      const { data: rawData, error } = await supabase
        .from('channel_memberships')
        .select(`
          user_id,
          role,
          users (
            id,
            email,
            username,
            avatar_url
          )
        `)
        .eq('channel_id', channelId)

      if (error) throw error

      // Safely cast the data
      const data = rawData as unknown as DatabaseChannelMember[]
      const members = data.map(item => ({
        id: item.users.id,
        email: item.users.email,
        username: item.users.username,
        avatar_url: item.users.avatar_url,
        role: item.role
      }))

      setChannelMembers(members)
    } catch (error) {
      console.error('Error loading channel members:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading members',
        description: 'Could not load channel members. Please try again.',
      })
    } finally {
      setIsLoadingChannel(false)
    }
  }

  const addMember = async (channelId: string, userId: string) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Permission denied',
        description: 'Only admins can add members to channels.',
      })
      return false
    }

    // Check if user is a workspace member
    const isWorkspaceMember = workspaceMembers.some(member => member.id === userId)
    if (!isWorkspaceMember) {
      toast({
        variant: 'destructive',
        title: 'Invalid member',
        description: 'User must be a workspace member to be added to a channel.',
      })
      return false
    }

    try {
      const { error } = await supabase
        .from('channel_memberships')
        .insert([{
          channel_id: channelId,
          user_id: userId,
          role: 'member'
        }])

      if (error) throw error

      await loadChannelMembers(channelId)
      return true
    } catch (error) {
      console.error('Error adding member:', error)
      toast({
        variant: 'destructive',
        title: 'Error adding member',
        description: 'Could not add member to channel. Please try again.',
      })
      return false
    }
  }

  const removeMember = async (channelId: string, userId: string) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Permission denied',
        description: 'Only admins can remove members from channels.',
      })
      return false
    }

    try {
      const { error } = await supabase
        .from('channel_memberships')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId)

      if (error) throw error

      await loadChannelMembers(channelId)
      return true
    } catch (error) {
      console.error('Error removing member:', error)
      toast({
        variant: 'destructive',
        title: 'Error removing member',
        description: 'Could not remove member from channel. Please try again.',
      })
      return false
    }
  }

  const updateChannelPrivacy = async (channelId: string, isPrivate: boolean) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Permission denied',
        description: 'Only admins can change channel privacy settings.',
      })
      return false
    }

    try {
      const { error } = await supabase
        .from('channels')
        .update({ is_private: isPrivate })
        .eq('id', channelId)

      if (error) throw error

      toast({
        title: 'Channel updated',
        description: `Channel is now ${isPrivate ? 'private' : 'public'}.`,
      })
      return true
    } catch (error) {
      console.error('Error updating channel privacy:', error)
      toast({
        variant: 'destructive',
        title: 'Error updating channel',
        description: 'Could not update channel privacy. Please try again.',
      })
      return false
    }
  }

  const updateMemberRole = async (userId: string, newRole: 'member' | 'admin') => {
    if (!selectedChannel) return false

    try {
      const { error } = await supabase
        .from('channel_memberships')
        .update({ role: newRole })
        .eq('channel_id', selectedChannel.id)
        .eq('user_id', userId)

      if (error) throw error

      // Update local state
      setChannelMembers(prev =>
        prev.map(member =>
          member.id === userId
            ? { ...member, role: newRole }
            : member
        )
      )

      toast({
        title: 'Role updated',
        description: `User role has been updated to ${newRole}.`,
      })

      return true
    } catch (error) {
      console.error('Error updating member role:', error)
      toast({
        variant: 'destructive',
        title: 'Error updating role',
        description: 'Could not update member role. Please try again.',
      })
      return false
    }
  }

  return {
    isAdmin,
    channelMembers,
    workspaceMembers,
    isLoadingChannel,
    isLoadingWorkspace,
    loadChannelMembers,
    addMember,
    removeMember,
    updateChannelPrivacy,
    updateMemberRole,
  }
} 