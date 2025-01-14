'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import WorkspacePage from '@/components/workspace-page'
import ChannelMessageArea from '@/components/channel-message-area'
import DirectMessageArea from '@/components/direct-message-area'
import { ChannelManagement } from '@/components/channel-management'
import { AdminPanel } from '@/components/admin-panel'
import { UserProfileSettings } from '@/components/user-profile-settings'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { useChannels } from '@/hooks/use-channels'
import { useAuth } from '@/contexts/auth-context'
import type { Channel } from '@/types'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SearchDialog, type SearchResult } from '@/components/search-dialog'
import { Search } from 'lucide-react'
import { CommandInput } from '@/components/ui/command'
import { toast } from '@/hooks/use-toast'

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

function AppContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile, isInitialized, isLoading: isAuthLoading } = useAuth()
  const { workspaces, isLoading: isWorkspacesLoading, createWorkspace, deleteWorkspace } = useWorkspaces()
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [activeDM, setActiveDM] = useState<string | null>(null)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const { channels } = useChannels(activeWorkspace?.id)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (isInitialized && !isAuthLoading && !profile) {
      console.log('No profile found, redirecting to signin')
      router.push('/auth/signin')
    }
  }, [isInitialized, isAuthLoading, profile, router])

  // Update active workspace when workspaces load or change
  useEffect(() => {
    let mounted = true
    console.log('Workspace effect running:', { 
      workspacesCount: workspaces.length,
      isWorkspacesLoading,
      activeWorkspaceId: activeWorkspace?.id,
      searchParamsWorkspace: searchParams.get('workspace')
    })

    if (mounted && !isWorkspacesLoading && workspaces.length > 0) {
      const workspaceId = searchParams.get('workspace')
      
      if (workspaceId) {
        // If we have a workspace ID in the URL, try to select it
        const workspace = workspaces.find(w => w.id === workspaceId)
        if (workspace) {
          console.log('Setting workspace from URL:', workspace.id)
          setActiveWorkspace(workspace)
          return
        }
      }
      
      // If the active workspace was deleted, clear it
      if (activeWorkspace && !workspaces.find(w => w.id === activeWorkspace.id)) {
        console.log('Active workspace was deleted, clearing state')
        setActiveWorkspace(null)
        setActiveChannel(null)
        setActiveDM(null)
      }
      // If no active workspace and workspaces exist, select the first one
      else if (!activeWorkspace) {
        console.log('Setting first workspace as active:', workspaces[0].id)
        setActiveWorkspace(workspaces[0])
      }
    }

    return () => {
      mounted = false
    }
  }, [workspaces, isWorkspacesLoading, activeWorkspace, searchParams])

  const handleSelectWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId)
    setActiveWorkspace(workspace || null)
    setActiveChannel(null)
    setActiveDM(null)
    setActiveTab('chat')
  }, [workspaces])

  const handleCreateWorkspace = useCallback(async (name: string) => {
    const workspace = await createWorkspace(name)
    if (workspace) {
      setActiveWorkspace(workspace)
      return workspace
    }
    return null
  }, [createWorkspace])

  const handleDeleteWorkspace = useCallback(async (workspaceId: string) => {
    const success = await deleteWorkspace(workspaceId)
    if (success && activeWorkspace?.id === workspaceId) {
      setActiveWorkspace(null)
      setActiveChannel(null)
      setActiveDM(null)
    }
    return success
  }, [deleteWorkspace, activeWorkspace])

  const handleSelectChannel = useCallback(async (channelId: string | null) => {
    if (!activeWorkspace) return
    
    if (!channelId) {
      // Clear selection
      setActiveChannel(null)
      setActiveDM(null)
      // Clear URL params
      const url = new URL(window.location.href)
      url.searchParams.delete('channel')
      window.history.replaceState({}, '', url)
      return
    }
    
    // First try to find the channel in the list
    let channel = channels.find(c => c.id === channelId)
    
    // If not found immediately after creation, wait briefly and try again
    if (!channel) {
      console.log('[DEBUG] Channel not found immediately, waiting for update:', channelId)
      // Wait for next tick to allow channel list to update
      await new Promise(resolve => setTimeout(resolve, 100))
      channel = channels.find(c => c.id === channelId)
    }
    
    if (!channel) {
      console.log('[DEBUG] Channel not found in list:', channelId)
      // Channel was deleted or not found
      setActiveChannel(null)
      setActiveDM(null)
      // Clear URL params
      const url = new URL(window.location.href)
      url.searchParams.delete('channel')
      window.history.replaceState({}, '', url)
      // Show toast
      toast({
        variant: 'destructive',
        title: 'Channel not found',
        description: 'This channel may have been deleted.',
      })
      return
    }

    // Channel exists, set it as active
    setActiveChannel(channel)
    setActiveDM(null)
    // Update URL params
    const url = new URL(window.location.href)
    url.searchParams.set('channel', channelId)
    window.history.replaceState({}, '', url)
  }, [activeWorkspace, channels, toast])

  const handleSelectDM = useCallback((userId: string | null) => {
    setActiveDM(userId)
    setActiveChannel(null)
  }, [])

  const handleOpenProfileSettings = useCallback(() => {
    setShowProfileSettings(true)
  }, [])

  const handleCloseProfileSettings = useCallback(() => {
    setShowProfileSettings(false)
  }, [])

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    // Clear selection when not in chat tab
    if (tab !== 'chat') {
      setActiveChannel(null)
      setActiveDM(null)
      const url = new URL(window.location.href)
      url.searchParams.delete('channel')
      window.history.replaceState({}, '', url)
    }
  }, [])

  const handleSearchResult = useCallback((result: SearchResult) => {
    setShowSearch(false)
    setSearchQuery('')
    
    switch (result.type) {
      case 'message':
        // Navigate to message in channel
        if (result.channel_id) {
          handleSelectChannel(result.channel_id)
          // TODO: Scroll to message - will need to pass message ID to ChannelMessageArea
          setActiveTab('chat')
        }
        break
      case 'user':
        // Open DM with user
        handleSelectDM(result.id)
        setActiveTab('chat')
        break
      case 'channel':
        // Navigate to channel
        handleSelectChannel(result.id)
        setActiveTab('chat')
        break
    }
  }, [handleSelectChannel, handleSelectDM])

  // Show loading state while auth is initializing or checking
  if (!isInitialized || isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Initializing app...</p>
      </div>
    )
  }

  // Show loading state while workspaces are loading
  if (isWorkspacesLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Loading workspaces...</p>
      </div>
    )
  }

  // Don't render anything if not authenticated (redirect effect will handle it)
  if (!profile) {
    return null
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        onOpenProfileSettings={handleOpenProfileSettings}
      />

      <div className="flex-1 flex">
        {activeWorkspace && (
          <WorkspacePage
            workspace={activeWorkspace}
            workspaces={workspaces}
            onOpenProfileSettings={handleOpenProfileSettings}
            onSelectChannel={handleSelectChannel}
            onSelectDM={handleSelectDM}
            onTabChange={handleTabChange}
          />
        )}

        <div className="flex-1">
          {/* Stable header with themed search */}
          <div className="h-16 border-b bg-gradient-to-r from-[#4A3B8C]/5 to-[#5D3B9E]/5 flex items-center justify-center px-4">
            <div className="w-full max-w-2xl relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search users, channels, channel messages..."
                  className="w-full bg-background/50 border-[#4A3B8C]/20 focus-visible:ring-[#4A3B8C]/30 transition-colors placeholder:text-muted-foreground/70 pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSearch(true)}
                />
                {activeWorkspace && showSearch && (
                  <SearchDialog
                    workspaceId={activeWorkspace.id}
                    open={showSearch}
                    onOpenChange={setShowSearch}
                    onSelectResult={handleSearchResult}
                    query={searchQuery}
                    onQueryChange={setSearchQuery}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 h-[calc(100vh-4rem)]">
            {activeTab === 'chat' && activeChannel && (
              <ChannelMessageArea
                key={activeChannel.id}
                selectedChannelId={activeChannel.id}
                workspace={activeWorkspace!}
                onClose={() => setActiveChannel(null)}
              />
            )}

            {activeTab === 'chat' && activeDM && (
              <DirectMessageArea
                key={activeDM}
                selectedUserId={activeDM}
                workspace={activeWorkspace!}
                onClose={() => setActiveDM(null)}
              />
            )}

            {activeTab === 'manage' && (
              <ChannelManagement workspace={activeWorkspace} />
            )}

            {activeTab === 'admin' && (
              <AdminPanel
                workspaces={workspaces}
                currentWorkspaceId={activeWorkspace?.id || ''}
                onDeleteWorkspace={handleDeleteWorkspace}
                onClose={() => setActiveTab('chat')}
              />
            )}
          </div>
        </div>
      </div>

      <Dialog open={showProfileSettings} onOpenChange={handleCloseProfileSettings}>
        <UserProfileSettings onClose={handleCloseProfileSettings} />
      </Dialog>
    </div>
  )
}

export default function AppPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Loading app...</p>
      </div>
    }>
      <AppContent />
    </Suspense>
  )
} 