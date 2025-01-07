'use client'

import { useState } from 'react'
import { useChannels } from '@/hooks/use-channels'
import { useDirectMessages } from '@/hooks/use-direct-messages'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlusCircle, Settings, Hash, MessageSquare, UserPlus, X, ChevronLeft, ChevronRight, Users, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { SignOutButton } from './sign-out-button'
import { useToast } from '@/hooks/use-toast'
import { Workspace } from '@/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChannelManagement } from './channel-management'
import { AdminPanel } from './admin-panel'

interface WorkspacePageProps {
  workspace?: Workspace | null
  workspaces: Workspace[]
  onOpenProfileSettings: () => void
  onSelectChannel: (channelId: string) => void
  onSelectDM: (userId: string) => void
  onTabChange: (tab: string) => void
}

export default function WorkspacePage({ workspace, workspaces, onOpenProfileSettings, onSelectChannel, onSelectDM, onTabChange }: WorkspacePageProps) {
  const { profile } = useAuth()
  const { channels, isLoading: isLoadingChannels, createChannel } = useChannels(workspace?.id)
  const { recentChats } = useDirectMessages(workspace?.id, null)
  const [newChannelName, setNewChannelName] = useState('')
  const [showNewDM, setShowNewDM] = useState(false)
  const [newDMEmail, setNewDMEmail] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const { toast } = useToast()

  const handleAddChannel = async () => {
    if (!workspace?.id || !newChannelName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Channel name required',
        description: 'Please enter a name for your channel.',
      })
      return
    }

    const channel = await createChannel(newChannelName.trim())
    if (channel) {
      setNewChannelName('')
      onSelectChannel(channel.id)
      toast({
        title: 'Channel created',
        description: `#${channel.name} has been created successfully.`,
      })
    }
  }

  const handleAddDM = async () => {
    if (!newDMEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Email required',
        description: 'Please enter an email address.',
      })
      return
    }

    // TODO: Implement adding DM by email
    // For now, just show a toast
    toast({
      title: 'Not implemented',
      description: 'This feature is not yet implemented.',
    })
    setNewDMEmail('')
    setShowNewDM(false)
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    onTabChange(value)
  }

  return (
    <div className={`grid grid-rows-[auto,1fr,auto] h-full border-r ${isCollapsed ? 'w-16' : 'min-w-[16rem] max-w-xs'} transition-all duration-200`}>
      <div className="border-b">
        <div className="flex h-16 items-center px-2 justify-between">
          {!isCollapsed && workspace && <h1 className="text-xl font-semibold truncate px-2">{workspace.name}</h1>}
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!isCollapsed && workspace && (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1">
          <div className="px-2 pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="chat" className="flex-1">
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="manage" className="flex-1">
                <Users className="h-4 w-4 mr-2" />
                Manage
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex-1">
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chat" className="flex-1 overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="px-2 py-4 space-y-4">
                {/* Channels Section */}
                <div>
                  <h2 className="text-lg font-semibold px-2 mb-2">Channels</h2>
                  <div className="space-y-1">
                    {isLoadingChannels ? (
                      <div className="text-sm text-gray-500 px-2">Loading channels...</div>
                    ) : channels.length === 0 ? (
                      <div className="text-sm text-gray-500 px-2">No channels yet</div>
                    ) : (
                      channels.map((channel) => (
            <Button
              key={channel.id}
              variant="ghost"
                          className="w-full justify-start px-2"
              onClick={() => onSelectChannel(channel.id)}
            >
                          <Hash className="mr-2 h-4 w-4 shrink-0" />
                          <span className="truncate">{channel.name}</span>
            </Button>
                      ))
                    )}
                    <div className="flex items-center gap-2 mt-2 px-2">
            <Input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="New channel name"
                        className="flex-1 h-8"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddChannel()
                          } else if (e.key === 'Escape') {
                            setNewChannelName('')
                          }
                        }}
                      />
                      <Button size="sm" onClick={handleAddChannel}>
              <PlusCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
                </div>

                {/* Direct Messages Section */}
                <div>
                  <h2 className="text-lg font-semibold px-2 mb-2">Direct Messages</h2>
                  <div className="space-y-1">
                    {recentChats.map((chat) => (
            <Button
                        key={chat.user_id}
              variant="ghost"
                        className="w-full justify-start px-2"
                        onClick={() => onSelectDM(chat.user_id)}
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            {chat.username[0].toUpperCase()}
                          </div>
                          <span className="truncate">{chat.username}</span>
                        </div>
            </Button>
          ))}
                    {showNewDM ? (
                      <div className="flex items-center gap-2 mt-2 px-2">
                        <Input
                          value={newDMEmail}
                          onChange={(e) => setNewDMEmail(e.target.value)}
                          placeholder="Enter email"
                          className="flex-1 h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddDM()
                            } else if (e.key === 'Escape') {
                              setNewDMEmail('')
                              setShowNewDM(false)
                            }
                          }}
                        />
                        <Button size="sm" onClick={handleAddDM}>
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNewDM(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        className="w-full justify-start px-2"
                        onClick={() => setShowNewDM(true)}
                      >
                        <UserPlus className="mr-2 h-4 w-4 shrink-0" />
                        <span>New Message</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="manage" className="flex-1 overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="p-4">
                <p className="text-sm text-muted-foreground">Select the "Manage" tab in the main area to manage channels.</p>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="admin" className="flex-1 overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="p-4">
                <p className="text-sm text-muted-foreground">Select the "Admin" tab in the main area to access admin settings.</p>
        </div>
      </ScrollArea>
          </TabsContent>
        </Tabs>
      )}

      {!isCollapsed && !workspace && (
        <div className="flex-1 p-4">
          <div className="text-center text-muted-foreground">
            <p>Welcome to ChatGenius!</p>
            <p className="mt-2">Create or join a workspace to get started.</p>
          </div>
        </div>
      )}

      {/* User Profile Section - Fixed at bottom */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2">
        <div className={`flex ${isCollapsed ? 'justify-center' : 'flex-col items-center space-y-2'}`}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback>{profile?.username?.[0] || profile?.email?.[0]}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <>
              <div className="flex flex-col items-center min-w-0">
                <span className="font-semibold text-sm truncate max-w-full">{profile?.username || 'User'}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-full">{profile?.email}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenProfileSettings}>
            <Settings className="h-4 w-4" />
          </Button>
                <SignOutButton />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

