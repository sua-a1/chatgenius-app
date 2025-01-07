import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { User } from '@/types'

interface WorkspaceMember extends Omit<User, 'status'> {
  role: 'member' | 'admin'
  status: 'online' | 'offline' | 'away' | 'busy'
}

interface WorkspaceMembershipData {
  role: 'member' | 'admin'
  user: {
    id: string
    username: string
    email: string
    avatar_url: string
    status: 'online' | 'offline' | 'away' | 'busy'
    created_at: string
  }
}

export function useWorkspaceMembers(workspaceId: string | null) {
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadMembers = async () => {
    if (!workspaceId) return

    setIsLoading(true)
    try {
      const { data: memberships, error: membershipsError } = await supabase
        .from('workspace_memberships')
        .select(`
          role,
          user:users (
            id,
            username,
            email,
            avatar_url,
            status,
            created_at
          )
        `)
        .eq('workspace_id', workspaceId)

      if (membershipsError) throw membershipsError

      const formattedMembers: WorkspaceMember[] = (memberships || []).map(m => {
        const membership = m as unknown as WorkspaceMembershipData
        return {
          ...membership.user,
          role: membership.role,
          avatar: membership.user.avatar_url
        }
      })

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
      // First, find the user by email
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email.toLowerCase().trim())
        .single()

      if (userError) {
        if (userError.code === 'PGRST116') {
          throw new Error('User not found')
        }
        throw userError
      }

      // Check if user is already a member
      const { data: existingMember, error: existingError } = await supabase
        .from('workspace_memberships')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingError) throw existingError
      if (existingMember) {
        throw new Error('User is already a member of this workspace')
      }

      // Then add them to the workspace
      const { error: membershipError } = await supabase
        .from('workspace_memberships')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          role,
          joined_at: new Date().toISOString()
        })

      if (membershipError) throw membershipError

      toast({
        title: 'Member added',
        description: `Successfully added ${email} to the workspace`
      })

      // Reload members to get the updated list
      await loadMembers()
    } catch (error: any) {
      console.error('Error adding workspace member:', error)
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
        .from('workspace_memberships')
        .update({ role: newRole })
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)

      if (error) throw error

      toast({
        title: 'Role updated',
        description: `Member role updated to ${newRole}`
      })

      // Update local state
      setMembers(members.map(member =>
        member.id === userId ? { ...member, role: newRole } : member
      ))
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
        .from('workspace_memberships')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)

      if (error) throw error

      toast({
        title: 'Member removed',
        description: 'Member has been removed from the workspace'
      })

      // Update local state
      setMembers(members.filter(member => member.id !== userId))
    } catch (error: any) {
      console.error('Error removing workspace member:', error)
      toast({
        variant: 'destructive',
        title: 'Error removing member',
        description: error.message
      })
    }
  }

  // Load members when workspaceId changes
  useEffect(() => {
    loadMembers()
  }, [workspaceId])

  return {
    members,
    isLoading,
    addMember,
    updateMemberRole,
    removeMember
  }
} 