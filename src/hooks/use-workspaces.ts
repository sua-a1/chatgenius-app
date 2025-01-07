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
    } else {
      console.log('No profile ID available')
    }
  }, [profile?.id])

  const loadWorkspaces = async () => {
    try {
      setIsLoading(true)
      console.log('Starting to load workspaces...')

      // Get workspaces where user is owner
      const { data: ownedWorkspaces, error: ownedError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', profile!.id)

      if (ownedError) {
        console.error('Error loading owned workspaces:', ownedError)
        throw ownedError
      }

      // Get workspaces where user is a member
      const { data: memberWorkspaces, error: memberError } = await supabase
        .from('workspace_memberships')
        .select(`
          workspace_id,
          workspaces (
            id,
            name,
            owner_id,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', profile!.id)

      if (memberError) {
        console.error('Error loading member workspaces:', memberError)
        throw memberError
      }

      // Combine and deduplicate workspaces
      const memberWorkspacesList = memberWorkspaces
        .map(m => m.workspaces)
        .filter(w => w !== null)

      const allWorkspaces = [
        ...(ownedWorkspaces || []),
        ...memberWorkspacesList
      ]

      // Remove duplicates based on workspace ID
      const uniqueWorkspaces = Array.from(
        new Map(allWorkspaces.map(w => [w.id, w])).values()
      )

      console.log('All workspaces loaded:', uniqueWorkspaces)
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
    if (!profile?.id) return null

    try {
      // Start a Supabase transaction
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert([{
          name,
          owner_id: profile.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single()

      if (workspaceError) throw workspaceError

      // Add the creator as an admin member
      const { error: membershipError } = await supabase
        .from('workspace_memberships')
        .insert([{
          workspace_id: workspace.id,
          user_id: profile.id,
          role: 'admin',
          joined_at: new Date().toISOString(),
        }])

      if (membershipError) {
        // If membership creation fails, delete the workspace
        await supabase
          .from('workspaces')
          .delete()
          .eq('id', workspace.id)
        throw membershipError
      }

      setWorkspaces(prev => [...prev, workspace])
      return workspace
    } catch (error) {
      console.error('Error creating workspace:', error)
      toast({
        variant: 'destructive',
        title: 'Error creating workspace',
        description: 'Please try again later.',
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