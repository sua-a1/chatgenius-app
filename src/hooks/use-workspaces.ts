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

      // Set up realtime subscriptions
      const workspacesChannel = supabase
        .channel('workspaces')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workspaces',
          },
          async () => {
            await loadWorkspaces()
          }
        )
        .subscribe()

      const membershipsChannel = supabase
        .channel('workspace_memberships')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workspace_memberships',
            filter: `user_id=eq.${profile.id}`,
          },
          async () => {
            await loadWorkspaces()
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
    }
  }, [profile?.id])

  const loadWorkspaces = async () => {
    try {
      setIsLoading(true)
      console.log('Starting to load workspaces...')

      // Get all accessible workspaces from the secure view
      const { data: workspaces, error } = await supabase
        .from('accessible_workspaces')
        .select('*')

      if (error) {
        console.error('Error loading workspaces:', error)
        throw error
      }

      console.log('All workspaces:', workspaces)
      setWorkspaces(workspaces || [])
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
    if (!profile?.id) return null

    try {
      // Call the function to create workspace and membership atomically
      const { data: workspaceId, error: functionError } = await supabase
        .rpc('create_workspace_with_membership', {
          workspace_name: name,
          owner_id: profile.id
        })

      if (functionError) throw functionError

      // Get the created workspace data
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single()

      if (workspaceError) throw workspaceError

      setWorkspaces(prev => [...prev, workspace])
      return workspace
    } catch (error) {
      console.error('Error creating workspace:', error)
      toast({
        variant: 'destructive',
        title: 'Error creating workspace',
        description: error instanceof Error ? error.message : 'Please try again later.',
      })
      return null
    }
  }

  const updateWorkspace = async (id: string, name: string) => {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .update({ 
          name, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setWorkspaces(prev => 
        prev.map(w => w.id === id ? data : w)
      )
      return data
    } catch (error) {
      console.error('Error updating workspace:', error)
      toast({
        variant: 'destructive',
        title: 'Error updating workspace',
        description: 'Please try again later.',
      })
      return null
    }
  }

  const deleteWorkspace = async (id: string) => {
    try {
      // Delete workspace memberships first (due to foreign key constraint)
      const { error: membershipError } = await supabase
        .from('workspace_memberships')
        .delete()
        .eq('workspace_id', id)

      if (membershipError) throw membershipError

      // Then delete the workspace
      const { error: workspaceError } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', id)

      if (workspaceError) throw workspaceError

      setWorkspaces(prev => prev.filter(w => w.id !== id))
      return true
    } catch (error) {
      console.error('Error deleting workspace:', error)
      toast({
        variant: 'destructive',
        title: 'Error deleting workspace',
        description: 'Please try again later.',
      })
      return false
    }
  }

  return {
    workspaces,
    isLoading,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    refreshWorkspaces: loadWorkspaces,
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