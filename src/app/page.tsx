'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/sidebar'
import WorkspacePage from '@/components/workspace-page'
import ChannelMessageArea from '@/components/channel-message-area'
import DirectMessageArea from '@/components/direct-message-area'
import { ChannelManagement } from '@/components/channel-management'
import { AdminPanel } from '@/components/admin-panel'
import { UserProfileSettings } from '@/components/user-profile-settings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { useChannels } from '@/hooks/use-channels'
import type { Channel } from '@/types'

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export default function Home() {
  const { workspaces, isLoading, createWorkspace, deleteWorkspace } = useWorkspaces()
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [activeDM, setActiveDM] = useState<string | null>(null)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const { channels } = useChannels(activeWorkspace?.id)

  // Update active workspace when workspaces load or change
  useEffect(() => {
    console.log('Workspaces changed:', workspaces)
    // If the active workspace was deleted, clear it
    if (activeWorkspace && !workspaces.find(w => w.id === activeWorkspace.id)) {
      console.log('Active workspace was deleted, clearing state')
      setActiveWorkspace(null)
      setActiveChannel(null)
      setActiveDM(null)
    }
    // If no active workspace and workspaces exist, select the first one
    else if (workspaces.length > 0 && !activeWorkspace) {
      console.log('Setting first workspace as active')
      setActiveWorkspace(workspaces[0])
    }
  }, [workspaces, activeWorkspace])

  const handleSelectWorkspace = (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId)
    setActiveWorkspace(workspace || null)
    setActiveChannel(null)
    setActiveDM(null)
  }

  const handleCreateWorkspace = async (name: string) => {
    const workspace = await createWorkspace(name)
    if (workspace) {
      setActiveWorkspace(workspace)
      return workspace
    }
    return null
  }

  const handleDeleteWorkspace = async (workspaceId: string) => {
    const success = await deleteWorkspace(workspaceId)
    if (success && activeWorkspace?.id === workspaceId) {
      setActiveWorkspace(null)
      setActiveChannel(null)
      setActiveDM(null)
    }
    return success
  }

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

  const handleOpenProfileSettings = () => {
    setShowProfileSettings(true)
  }

  const handleCloseProfileSettings = () => {
    setShowProfileSettings(false)
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
  }

  const renderMainContent = () => {
    if (!activeWorkspace) return null

    switch (activeTab) {
      case 'chat':
        if (activeChannel) {
          return <ChannelMessageArea workspace={activeWorkspace} selectedChannelId={activeChannel.id} />
        }
        if (activeDM) {
          return <DirectMessageArea workspace={activeWorkspace} selectedUserId={activeDM} />
        }
        return null
      case 'manage':
        return <ChannelManagement workspace={activeWorkspace} />
      case 'admin':
        return <AdminPanel workspaces={workspaces} onDeleteWorkspace={handleDeleteWorkspace} />
      default:
        return null
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
        onCreateWorkspace={handleCreateWorkspace}
        onOpenProfileSettings={handleOpenProfileSettings}
      />
      <WorkspacePage
        workspace={activeWorkspace}
        workspaces={workspaces}
        onOpenProfileSettings={handleOpenProfileSettings}
        onSelectChannel={handleSelectChannel}
        onSelectDM={handleSelectDM}
        onTabChange={handleTabChange}
      />
      <main className="flex-1 flex flex-col">
        {renderMainContent()}
      </main>
      {showProfileSettings && (
        <UserProfileSettings onClose={() => setShowProfileSettings(false)} />
      )}
    </div>
  )
}

