'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { User } from '@/types'
import { useAuth } from '@/contexts/auth-context'

interface WorkspaceMember extends Omit<User, 'status'> {
  role: 'member' | 'admin'
  status: 'online' | 'offline' | 'away' | 'busy'
}

interface WorkspaceMemberData {
  user_id: string;
  role: 'member' | 'admin';
  username: string;
  email: string;
  avatar_url: string | null;
  status: 'online' | 'offline' | 'away' | 'busy';
  created_at: string;
}

export function useWorkspaceMembers(workspaceId: string | null) {
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const { profile } = useAuth()
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [workspace, setWorkspace] = useState<{ owner_id: string } | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [isMemberAdmin, setIsMemberAdmin] = useState(false)

  // Load initial data and set up subscriptions
  useEffect(() => {
    if (workspaceId) {
      loadWorkspace()
      loadMembers()
      
      // Set up realtime subscription for memberships
      const membershipsChannel = supabase
        .channel(`workspace_members:${workspaceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workspace_memberships',
            filter: `workspace_id=eq.${workspaceId}`
          },
          async () => {
            await loadMembers()
          }
        )
        .subscribe()

      // Set up realtime subscription for workspace changes
      const workspaceChannel = supabase
        .channel(`workspace:${workspaceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workspaces',
            filter: `id=eq.${workspaceId}`
          },
          async () => {
            await loadWorkspace()
          }
        )
        .subscribe()

      // Cleanup subscriptions
      return () => {
        membershipsChannel.unsubscribe()
        workspaceChannel.unsubscribe()
      }
    } else {
      setWorkspace(null)
      setMembers([])
      setIsOwner(false)
      setIsMemberAdmin(false)
    }
  }, [workspaceId])

  const loadWorkspace = async () => {
    if (!workspaceId) return

    try {
      console.log('Loading workspace details for:', workspaceId)
      const { data, error } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single()

      if (error) throw error
      console.log('Workspace details loaded:', data)
      setWorkspace(data)
      setIsOwner(data.owner_id === profile?.id)
    } catch (error) {
      console.error('Error loading workspace:', error)
      setWorkspace(null)
      setIsOwner(false)
    }
  }

  const loadMembers = async () => {
    if (!workspaceId) return

    setIsLoading(true)
    try {
      const { data: memberships, error: membershipsError } = await supabase
        .rpc('get_workspace_members_with_details', {
          target_workspace_id: workspaceId
        })

      if (membershipsError) throw membershipsError

      const formattedMembers: WorkspaceMember[] = (memberships || []).map((m: WorkspaceMemberData) => ({
        id: m.user_id,
        username: m.username,
        email: m.email,
        avatar: m.avatar_url,
        status: m.status,
        role: m.role
      }))

      setMembers(formattedMembers)
      
      // Update member admin status
      if (profile?.id) {
        const currentMember = formattedMembers.find(m => m.id === profile.id)
        setIsMemberAdmin(currentMember?.role === 'admin' || false)
      }
    } catch (error: any) {
      console.error('Error loading workspace members:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading members',
        description: error.message
      })
    } finally {
      setIsLoading(false)
    }
  }

  const isAdmin = isOwner || isMemberAdmin

  const addMember = async (email: string, role: 'member' | 'admin' = 'member') => {
    if (!workspaceId) return

    try {
      const { data: userId, error } = await supabase
        .rpc('add_workspace_member', {
          target_workspace_id: workspaceId,
          target_email: email,
          target_role: role
        })

      if (error) throw error

      toast({
        title: 'Member added',
        description: `Successfully added ${email} to the workspace.`
      })

      // Refresh the member list
      await loadMembers()
    } catch (error: any) {
      console.error('Error adding member:', error)
      toast({
        variant: 'destructive',
        title: 'Error adding member',
        description: error.message
      })
    }
  }

  const updateMemberRole = async (userId: string, newRole: 'member' | 'admin') => {
    if (!workspaceId) return

    try {
      const { error } = await supabase
        .rpc('update_workspace_member_role', {
          target_workspace_id: workspaceId,
          target_user_id: userId,
          new_role: newRole
        })

      if (error) throw error

      toast({
        title: 'Role updated',
        description: `Successfully updated member role to ${newRole}.`
      })

      // Refresh the member list
      await loadMembers()
    } catch (error: any) {
      console.error('Error updating member role:', error)
      toast({
        variant: 'destructive',
        title: 'Error updating role',
        description: error.message
      })
    }
  }

  const removeMember = async (userId: string) => {
    if (!workspaceId) return

    try {
      const { error } = await supabase
        .rpc('remove_workspace_member', {
          target_workspace_id: workspaceId,
          target_user_id: userId
        })

      if (error) throw error

      toast({
        title: 'Member removed',
        description: 'Successfully removed member from workspace.'
      })

      // Refresh the member list
      await loadMembers()
    } catch (error: any) {
      console.error('Error removing member:', error)
      toast({
        variant: 'destructive',
        title: 'Error removing member',
        description: error.message
      })
    }
  }

  return {
    members,
    isLoading,
    addMember,
    updateMemberRole,
    removeMember,
    isAdmin
  }
} 