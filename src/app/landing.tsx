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

export default function Home() {
  const { workspaces, isLoading, createWorkspace } = useWorkspaces()
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [activeDM, setActiveDM] = useState<string | null>(null)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const { channels } = useChannels(activeWorkspace?.id)
  const [activeTab, setActiveTab] = useState('chat')

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

  const handleSelectChannel = (channelId: string) => {
    if (!activeWorkspace) return
    const channel = channels.find(c => c.id === channelId)
    if (channel) {
      setActiveChannel(channel)
    setActiveDM(null)
    }
  }

  const handleSelectDM = (userId: string) => {
    setActiveDM(userId)
    setActiveChannel(null)
  }

  const handleOpenProfileSettings = useCallback(() => {
    setShowProfileSettings(true)
  }, [])

  const handleCloseProfileSettings = () => {
    setShowProfileSettings(false)
  }

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    // Reset active states when switching tabs
    if (tab !== 'chat') {
      setActiveChannel(null)
      setActiveDM(null)
    }
  }, [])

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
              workspace={activeWorkspace} 
              onTabChange={handleTabChange} 
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
          <WorkspacePage 
            workspace={activeWorkspace}
          workspaces={workspaces}
          onOpenProfileSettings={handleOpenProfileSettings}
            onSelectChannel={handleSelectChannel}
            onSelectDM={handleSelectDM}
          onTabChange={handleTabChange}
        />
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

