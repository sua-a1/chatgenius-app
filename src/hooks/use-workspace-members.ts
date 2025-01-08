import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { User } from '@/types'

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
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load initial data and set up subscriptions
  useEffect(() => {
    if (workspaceId) {
      loadMembers()
      
      // Set up realtime subscription
      const channel = supabase
        .channel(`workspace_members:${workspaceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workspace_memberships',
            filter: `workspace_id=eq.${workspaceId}`
          },
          async (payload) => {
            // Reload the entire member list when any change occurs
            // This ensures we have the most up-to-date data including user details
            await loadMembers()
          }
        )
        .subscribe()

      // Cleanup subscription
      return () => {
        channel.unsubscribe()
      }
    }
  }, [workspaceId])

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

      // Reload members to get updated list
      await loadMembers()
      toast({
        title: 'Member added',
        description: 'Successfully added new member to the workspace.'
      })
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

      // Update local state
      setMembers(prev =>
        prev.map(member =>
          member.id === userId
            ? { ...member, role: newRole }
            : member
        )
      )

      toast({
        title: 'Role updated',
        description: `Successfully updated member role to ${newRole}.`
      })
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

      // Update local state
      setMembers(prev => prev.filter(member => member.id !== userId))

      toast({
        title: 'Member removed',
        description: 'Successfully removed member from workspace.'
      })
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
    removeMember
  }
} 