'use client'

import { Suspense, useCallback } from 'react'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/sidebar'
import WorkspacePage from '@/components/workspace-page'
import ChatArea from '@/components/chat-area'
import DirectMessageArea from '@/components/direct-message-area'
import { ChannelManagement } from '@/components/channel-management'
import { AdminPanel } from '@/components/admin-panel'
import { UserProfileSettings } from '@/components/user-profile-settings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Channel, Workspace } from '@/types'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { useChannels } from '@/hooks/use-channels'
import { useToast } from '@/hooks/use-toast'

export default function Home() {
  const { workspaces, isLoading, createWorkspace } = useWorkspaces()
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [activeDM, setActiveDM] = useState<string | null>(null)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const { channels } = useChannels(activeWorkspace?.id)
  const [activeTab, setActiveTab] = useState('chat')
  const { toast } = useToast()

  // Update active workspace when workspaces load
  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspace) {
      setActiveWorkspace(workspaces[0])
    }
  }, [workspaces, activeWorkspace])

  const handleSelectWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId)
    setActiveWorkspace(workspace || null)
  }, [workspaces])

  const handleCreateWorkspace = useCallback(async (name: string) => {
    const workspace = await createWorkspace(name)
    if (workspace) {
      setActiveWorkspace(workspace)
      return workspace
    }
    return null
  }, [createWorkspace])

  const handleSelectChannel = useCallback((channelId: string | null) => {
    if (!channelId) {
      setActiveChannel(null);
      return;
    }
    console.log('[DEBUG] Channel selected:', channelId)
    // Verify channel exists in current list
    const channel = channels.find(c => c.id === channelId)
    if (!channel) {
      console.log('[DEBUG] Selected channel not found, showing error')
      toast({
        variant: 'destructive',
        title: 'Channel not found',
        description: 'This channel may have been deleted.',
      })
      setActiveChannel(null)
      return
    }
    setActiveChannel(channel)
    setActiveDM(null)
  }, [channels, toast])

  const handleSelectDM = (userId: string | null) => {
    setActiveDM(userId)
    setActiveChannel(null)
  }

  const handleOpenProfileSettings = useCallback(() => {
    setShowProfileSettings(true)
  }, [])

  const handleCloseProfileSettings = () => {
    setShowProfileSettings(false)
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    // Reset active states when switching tabs
    if (tab !== 'chat') {
      setActiveChannel(null)
      setActiveDM(null)
    }
  }

  const renderMainContent = () => {
    if (!activeWorkspace) return null

    switch (activeTab) {
      case 'manage':
        return (
          <div className="flex-1 p-4">
            <ChannelManagement workspace={activeWorkspace} />
          </div>
        )
      case 'admin':
        return (
          <div className="flex-1 p-4">
            <AdminPanel 
              workspaces={workspaces} 
              currentWorkspaceId={activeWorkspace?.id || ''}
            />
          </div>
        )
      default:
        return (
          <div className="flex-1">
            {activeChannel ? (
              <ChatArea channel={activeChannel} />
            ) : activeDM ? (
              <DirectMessageArea workspace={activeWorkspace} selectedUserId={activeDM} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-sm text-gray-500">Select a channel or user to start messaging</span>
              </div>
            )}
          </div>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Loading workspaces...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <Sidebar 
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={handleSelectWorkspace}
        onOpenProfileSettings={handleOpenProfileSettings}
        onCreateWorkspace={handleCreateWorkspace}
      />
      <div className="flex flex-1">
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
          {activeWorkspace && renderMainContent()}
      </div>
      {showProfileSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6">
            <UserProfileSettings onClose={handleCloseProfileSettings} />
          </div>
        </div>
      )}
    </div>
  )
}

