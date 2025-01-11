'use client'

import { useState, useEffect, useMemo } from 'react'
import { useChannels } from '@/hooks/use-channels'
import { useDirectMessages } from '@/hooks/use-direct-messages'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlusCircle, Settings, Hash, MessageSquare, UserPlus, X, ChevronLeft, ChevronRight, Users, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useUserStatus } from '@/contexts/user-status-context'
import { SignOutButton } from './sign-out-button'
import { useToast } from '@/hooks/use-toast'
import { Workspace } from '@/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChannelManagement } from './channel-management'
import { AdminPanel } from './admin-panel'
import { UserProfileDisplay } from './user-profile-display'
import type { UserProfile } from '@/contexts/auth-context'
import { UserMenu } from '@/components/user-menu'
import { useWorkspaceMembers } from '@/hooks/use-workspace-members'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { UserAvatar } from '@/components/ui/user-avatar'

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
  const { userStatuses } = useUserStatus()
  const [newChannelName, setNewChannelName] = useState('')
  const [showNewDM, setShowNewDM] = useState(false)
  const [newDMEmail, setNewDMEmail] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const { toast } = useToast()
  const { channels, isLoading: isLoadingChannels, createChannel } = useChannels(workspace?.id)
  const { recentChats, isLoading: isLoadingDMs, refreshChats } = useDirectMessages(workspace?.id, null)
  const [displayProfile, setDisplayProfile] = useState(profile)
  const { members, isLoading: isLoadingMembers } = useWorkspaceMembers(workspace?.id || null)
  const [showMemberSearch, setShowMemberSearch] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')

  const filteredMembers = useMemo(() => {
    if (!members) return []
    if (!memberSearchQuery.trim()) return members
    
    const query = memberSearchQuery.toLowerCase().trim()
    return members.filter(member => 
      member.username?.toLowerCase().includes(query) || 
      member.email?.toLowerCase().includes(query)
    )
  }, [members, memberSearchQuery])

  // Update display profile when auth profile changes
  useEffect(() => {
    setDisplayProfile(profile)
  }, [profile])

  // Listen for profile updates
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent<UserProfile>) => {
      if (event.detail.id === profile?.id) {
        console.log('Updating workspace profile display:', event.detail)
        setDisplayProfile(event.detail)
      }
    }

    window.addEventListener('profileUpdated', handleProfileUpdate as EventListener)
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener)
    }
  }, [profile?.id])

  // Debug logs
  useEffect(() => {
    console.log('WorkspacePage: State', { 
      isLoadingDMs, 
      recentChatsLength: recentChats?.length,
      workspaceId: workspace?.id,
      profileId: profile?.id
    })
  }, [isLoadingDMs, recentChats, workspace?.id, profile?.id])

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

  const handleAddDM = () => {
    setShowMemberSearch(true)
  }

  const handleSelectMember = async (userId: string) => {
    setShowMemberSearch(false)
    await onSelectDM(userId)
    // Refresh the chats list to show the new conversation
    refreshChats()
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    onTabChange(value)
  }

  console.log('WorkspacePage: Rendering', { 
    workspace, 
    profileId: profile?.id, 
    isLoadingDMs,
    recentChatsLength: recentChats.length 
  })

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
                    {isLoadingDMs && (
                      <div className="text-sm text-gray-500 px-2">Loading chats...</div>
                    )}
                    {!isLoadingDMs && recentChats.length === 0 && (
                      <div className="text-sm text-gray-500 px-2">No direct messages yet</div>
                    )}
                    {!isLoadingDMs && recentChats.length > 0 && (
                      <>
                        {recentChats.map((chat) => {
                          const handleDMClick = () => {
                            console.log('Opening DM with user:', chat.user_id);
                            onSelectDM(chat.user_id);
                          };

                          return (
                            <div key={chat.user_id} className="flex items-center w-full gap-1">
                            <Button
                              variant="ghost"
                                className="flex-1 justify-start px-2"
                                onClick={handleDMClick}
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <Avatar 
                                  className="h-6 w-6"
                                  status={userStatuses.get(chat.user_id)}
                                >
                                  <AvatarImage src={chat.avatar_url || undefined} />
                                  <AvatarFallback>{chat.username ? chat.username[0].toUpperCase() : '?'}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{chat.username}</span>
                              </div>
                            </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={handleDMClick}
                                title="Open chat"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </>
                    )}
                    {showNewDM ? (
                      <div className="flex items-center gap-2 mt-2 px-2">
                        <Button 
                          size="sm" 
                          className="w-full justify-start h-8" 
                          variant="ghost"
                          onClick={handleAddDM}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          New Message
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={() => setShowNewDM(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => setShowNewDM(true)}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        New Message
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
            Select a workspace to get started
          </div>
        </div>
      )}

      {/* User Profile Section - Fixed at bottom */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2">
        <div className={`flex ${isCollapsed ? 'justify-center' : 'flex-col items-center space-y-2'}`}>
          <UserMenu onOpenProfileSettings={onOpenProfileSettings} isCollapsed={isCollapsed} />
        </div>
      </div>

      <CommandDialog open={showMemberSearch} onOpenChange={setShowMemberSearch}>
        <CommandInput 
          placeholder="Search workspace members..." 
          value={memberSearchQuery}
          onValueChange={setMemberSearchQuery}
        />
        <CommandList>
          <CommandEmpty>No members found.</CommandEmpty>
          <CommandGroup heading="Workspace Members">
            {filteredMembers?.map(member => (
              <CommandItem
                key={member.id}
                value={`${member.username} ${member.email}`}
                onSelect={() => handleSelectMember(member.id)}
                className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
              >
                <UserAvatar 
                  user={{
                    id: member.id,
                    username: member.username,
                    email: member.email,
                    avatar_url: member.avatar_url,
                    created_at: member.created_at
                  }} 
                  size="sm" 
                />
                <div className="ml-2">
                  <div className="font-medium text-foreground">{member.username}</div>
                  <div className="text-sm text-muted-foreground">{member.email}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  )
}

