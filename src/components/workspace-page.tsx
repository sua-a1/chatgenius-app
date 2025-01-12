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
import { Workspace, Channel } from '@/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChannelManagement } from './channel-management'
import { AdminPanel } from './admin-panel'
import { UserProfileDisplay } from './user-profile-display'
import type { UserProfile } from '@/contexts/auth-context'
import { UserMenu } from '@/components/user-menu'
import { useWorkspaceMembers } from '@/hooks/use-workspace-members'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Logo } from '@/components/logo'

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

  const handleChannelSelect = (channelId: string) => {
    onSelectChannel(channelId)
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
    <div className={`grid grid-rows-[auto,1fr,auto] h-full border-r ${isCollapsed ? 'w-16' : 'min-w-[16rem] max-w-xs'} transition-all duration-200 bg-gradient-to-b from-[#4A3B8C]/5 to-[#5D3B9E]/5`}>
      <div className="border-b bg-gradient-to-r from-[#4A3B8C]/5 to-[#5D3B9E]/5">
        <div className="flex h-16 items-center">
          {!isCollapsed ? (
            <div className="flex items-center gap-2 px-4 flex-1">
              {workspace && <h1 className="text-xl font-semibold truncate text-foreground/90">{workspace.name}</h1>}
            </div>
          ) : (
            <div className="flex-1 flex justify-center">
              <span className="text-xl font-semibold text-foreground/90">{workspace?.name[0]}</span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)} className="hover:bg-[#4A3B8C]/10 shrink-0">
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!isCollapsed && workspace && (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-2 pt-2">
            <TabsList className="w-full bg-[#4A3B8C]/5">
              <TabsTrigger 
                value="chat" 
                className="flex-1 data-[state=active]:bg-[#4A3B8C]/20 data-[state=active]:text-foreground"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat
              </TabsTrigger>
              <TabsTrigger 
                value="manage" 
                className="flex-1 data-[state=active]:bg-[#4A3B8C]/20 data-[state=active]:text-foreground"
              >
                <Users className="h-4 w-4 mr-2" />
                Manage
              </TabsTrigger>
              <TabsTrigger 
                value="admin" 
                className="flex-1 data-[state=active]:bg-[#4A3B8C]/20 data-[state=active]:text-foreground"
              >
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </TabsTrigger>
            </TabsList>
          </div>

          {activeTab === 'chat' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1">
                <div className="px-2 py-4 space-y-4">
                  {/* Channels Section */}
                  <div>
                    <h2 className="text-lg font-semibold px-2 mb-2">Channels</h2>
                    <div className="space-y-1">
                      {isLoadingChannels ? (
                        <div className="text-sm text-muted-foreground px-2">Loading channels...</div>
                      ) : channels.length === 0 ? (
                        <div className="text-sm text-muted-foreground px-2">No channels yet</div>
                      ) : (
                        channels.map((channel) => (
                          <Button
                            key={channel.id}
                            variant="ghost"
                            className="w-full justify-start px-2 hover:bg-[#3A2E6E]/10"
                            onClick={() => handleChannelSelect(channel.id)}
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
                        <Button 
                          size="sm" 
                          onClick={handleAddChannel}
                          className="bg-[#3A2E6E] hover:bg-[#2A2154]"
                        >
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
                        <div className="text-sm text-muted-foreground px-2">Loading chats...</div>
                      )}
                      {!isLoadingDMs && recentChats.length === 0 && (
                        <div className="text-sm text-muted-foreground px-2">No direct messages yet</div>
                      )}
                      {!isLoadingDMs && recentChats.length > 0 && (
                        <>
                          {recentChats.map((chat) => (
                            <Button
                              key={chat.user_id}
                              variant="ghost"
                              className="w-full justify-start px-2 hover:bg-[#3A2E6E]/10"
                              onClick={() => onSelectDM(chat.user_id)}
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
                          ))}
                        </>
                      )}
                      <Button
                        variant="ghost"
                        className="w-full justify-start px-2 hover:bg-[#3A2E6E]/10"
                        onClick={handleAddDM}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        <span>New Message</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </Tabs>
      )}

      <div className="border-t p-2">
        <UserMenu onOpenProfileSettings={onOpenProfileSettings} isCollapsed={isCollapsed} />
      </div>

      {/* Member Search Dialog */}
      <CommandDialog open={showMemberSearch} onOpenChange={setShowMemberSearch}>
        <CommandInput 
          placeholder="Search members..." 
          value={memberSearchQuery}
          onValueChange={setMemberSearchQuery}
        />
        <CommandList>
          <CommandEmpty>No members found.</CommandEmpty>
          <CommandGroup>
            {filteredMembers.map((member) => (
              <CommandItem
                key={member.id}
                onSelect={() => handleSelectMember(member.id)}
                className="flex items-center gap-2 cursor-pointer hover:bg-[#4A3B8C]/10"
              >
                <UserAvatar
                  user={member}
                  className="h-6 w-6"
                />
                <span>{member.username}</span>
                <span className="text-sm text-muted-foreground">{member.email}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  )
}

