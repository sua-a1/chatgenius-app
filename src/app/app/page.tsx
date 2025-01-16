'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
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

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (isInitialized && !isAuthLoading && !profile) {
      router.push('/auth/signin')
    }
  }, [isInitialized, isAuthLoading, profile, router])

  // Update active workspace when workspaces load or change
  useEffect(() => {
    let mounted = true

    if (mounted && !isWorkspacesLoading && workspaces.length > 0) {
      const workspaceId = searchParams.get('workspace')
      
      if (workspaceId) {
        const workspace = workspaces.find(w => w.id === workspaceId)
        if (workspace) {
          setActiveWorkspace(workspace)
          return
        }
      }
      
      if (activeWorkspace && !workspaces.find(w => w.id === activeWorkspace.id)) {
        setActiveWorkspace(null)
        setActiveChannel(null)
        setActiveDM(null)
      }
      else if (!activeWorkspace) {
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

  const handleSelectChannel = useCallback((channelId: string) => {
    if (!activeWorkspace) return
    const channel = channels.find(c => c.id === channelId)
    if (channel) {
      setActiveChannel(channel)
      setActiveDM(null)
      setActiveTab('chat')
    }
  }, [activeWorkspace, channels])

  const handleSelectDM = useCallback((userId: string) => {
    setActiveDM(userId)
    setActiveChannel(null)
    setActiveTab('chat')
  }, [])

  const handleOpenProfileSettings = useCallback(() => {
    setShowProfileSettings(true)
  }, [])

  const handleCloseProfileSettings = useCallback(() => {
    setShowProfileSettings(false)
  }, [])

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    setActiveChannel(null)
    setActiveDM(null)
  }, [])

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

  const renderMainContent = () => {
    switch (activeTab) {
      case 'chat':
        if (activeChannel) {
          return (
            <ChannelMessageArea
              key={activeChannel.id}
              selectedChannelId={activeChannel.id}
              workspace={activeWorkspace!}
              onClose={() => setActiveChannel(null)}
            />
          )
        }
        if (activeDM) {
          return (
            <DirectMessageArea
              key={activeDM}
              selectedUserId={activeDM}
              workspace={activeWorkspace!}
              onClose={() => setActiveDM(null)}
            />
          )
        }
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a channel or direct message to start chatting
          </div>
        )
      case 'manage':
        return <ChannelManagement workspace={activeWorkspace} onTabChange={handleTabChange} />
      case 'admin':
        return (
          <AdminPanel
            workspaces={workspaces}
            onDeleteWorkspace={handleDeleteWorkspace}
            onTabChange={handleTabChange}
          />
        )
      default:
        return null
    }
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

      <div className="flex-1 flex flex-col">
        {activeWorkspace && (
          <WorkspacePage
            workspace={activeWorkspace}
            workspaces={workspaces}
            onOpenProfileSettings={handleOpenProfileSettings}
            onSelectChannel={handleSelectChannel}
            onSelectDM={handleSelectDM}
            onTabChange={handleTabChange}
          >
            {renderMainContent()}
          </WorkspacePage>
        )}
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