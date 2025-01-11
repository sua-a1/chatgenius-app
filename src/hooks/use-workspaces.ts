'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Workspace } from '@/types'
import { useToast } from './use-toast'

interface WorkspaceMembershipWithWorkspace {
  workspace_id: string
  workspaces: {
    id: string
    name: string
    owner_id: string
    created_at: string
    updated_at: string
  }
}

export function useWorkspaces() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (profile?.id) {
      console.log('Loading workspaces for user:', profile.id)
      loadWorkspaces()

      // Set up realtime subscriptions with unique channel names
      const workspacesChannel = supabase
        .channel('workspaces-' + profile.id)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workspaces'
          },
          () => {
            loadWorkspaces()
          }
        )
        .subscribe()

      const membershipsChannel = supabase
        .channel('memberships-' + profile.id)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workspace_memberships'
          },
          () => {
            loadWorkspaces()
          }
        )
        .subscribe()

      // Cleanup subscriptions
      return () => {
        workspacesChannel.unsubscribe()
        membershipsChannel.unsubscribe()
      }
    } else {
      console.log('No profile ID available')
      setWorkspaces([])
      setIsLoading(false)
    }
  }, [profile?.id])

  const loadWorkspaces = async () => {
    try {
      if (!profile?.id) {
        console.log('No profile ID available, skipping workspace load')
        setWorkspaces([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      console.log('Starting to load workspaces for user:', profile.id)

      // First query: Get workspaces where user is owner
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from('workspaces')
        .select('id, name, owner_id, created_at, updated_at')
        .eq('owner_id', profile.id)

      if (ownedError) throw ownedError

      // Second query: Get workspaces where user is a member
      type WorkspaceMembership = {
        workspace_id: string;
        workspaces: Workspace;
      }

      const { data: memberWorkspaces, error: memberError } = await supabase
        .from('workspace_memberships')
        .select(`
          workspace_id,
          workspaces:workspaces!inner (
            id,
            name,
            owner_id,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', profile.id) as { data: WorkspaceMembership[] | null; error: any }

      if (memberError) throw memberError

      // Combine and deduplicate workspaces
      const memberWorkspacesData = memberWorkspaces?.map(m => m.workspaces) || []
      const allWorkspaces = [...(ownedWorkspaces || []), ...memberWorkspacesData]
      const uniqueWorkspaces = Array.from(
        new Map(allWorkspaces.map(w => [w.id, w])).values()
      )

      console.log('Loaded workspaces:', uniqueWorkspaces)
      setWorkspaces(uniqueWorkspaces)
    } catch (error) {
      console.error('Error loading workspaces:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading workspaces',
        description: error instanceof Error ? error.message : 'Please try again later.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createWorkspace = async (name: string) => {
    try {
      if (!profile?.id) {
        throw new Error('No profile ID available')
      }

      const { data: workspace, error } = await supabase
        .from('workspaces')
        .insert([
          { name, owner_id: profile.id }
        ])
        .select()
        .single()

      if (error) throw error

      // Add the creator as a member
      const { error: membershipError } = await supabase
        .from('workspace_memberships')
        .insert([
          { workspace_id: workspace.id, user_id: profile.id }
        ])

      if (membershipError) throw membershipError

      toast({
        title: 'Workspace created',
        description: `${name} has been created successfully.`,
      })

      return workspace
    } catch (error: any) {
      console.error('Error creating workspace:', error)
      toast({
        variant: 'destructive',
        title: 'Error creating workspace',
        description: error?.message || 'An unexpected error occurred. Please try again.',
      })
      return null
    }
  }

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      if (!profile?.id) {
        throw new Error('No profile ID available')
      }

      // First check if the user is the owner
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single()

      if (workspaceError) throw workspaceError

      if (workspace.owner_id !== profile.id) {
        throw new Error('Only the workspace owner can delete the workspace')
      }

      // Delete the workspace (this will cascade to memberships and channels)
      const { error: deleteError } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId)

      if (deleteError) throw deleteError

      toast({
        title: 'Workspace deleted',
        description: 'The workspace has been deleted successfully.',
      })

      return true
    } catch (error: any) {
      console.error('Error deleting workspace:', error)
      toast({
        variant: 'destructive',
        title: 'Error deleting workspace',
        description: error?.message || 'An unexpected error occurred. Please try again.',
      })
      return false
    }
  }

  return {
    workspaces,
    isLoading,
    createWorkspace,
    deleteWorkspace
  }
}

export function useWorkspace(workspaceId: string | undefined) {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (profile?.id && workspaceId) {
      loadWorkspace()
    }
  }, [profile?.id, workspaceId])

  const loadWorkspace = async () => {
    try {
      setIsLoading(true)

      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single()

      if (error) throw error

      setWorkspace(data)
    } catch (error) {
      console.error('Error loading workspace:', error)
      toast({
        variant: 'destructive',
        title: 'Error loading workspace',
        description: 'Could not load workspace. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return {
    workspace,
    isLoading,
    refreshWorkspace: loadWorkspace,
  }
} 