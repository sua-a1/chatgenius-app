'use client'

import { useState, useEffect, useMemo } from 'react'
import { useChannels } from '@/hooks/use-channels'
import { useDirectMessages } from '@/hooks/use-direct-messages'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlusCircle, Settings, Hash, MessageSquare, UserPlus, X, ChevronLeft, ChevronRight, Users, Shield, Bot, Search } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useUserStatus } from '@/contexts/user-status-context'
import { SignOutButton } from './sign-out-button'
import { useToast } from '@/hooks/use-toast'
import { Workspace } from '@/types'
import { UserProfileDisplay } from './user-profile-display'
import type { UserProfile } from '@/contexts/auth-context'
import { UserMenu } from '@/components/user-menu'
import { useWorkspaceMembers } from '@/hooks/use-workspace-members'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { UserAvatar } from '@/components/ui/user-avatar'
import { Logo } from '@/components/logo'
import { AIChatWindow } from './ai/chat-window'

interface WorkspacePageProps {
  workspace?: Workspace | null
  workspaces: Workspace[]
  onOpenProfileSettings: () => void
  onSelectChannel: (channelId: string) => void
  onSelectDM: (userId: string) => void
  onTabChange: (tab: string) => void
  children?: React.ReactNode
}

export default function WorkspacePage({ workspace, workspaces, onOpenProfileSettings, onSelectChannel, onSelectDM, onTabChange, children }: WorkspacePageProps) {
  const { profile } = useAuth()
  const { userStatuses } = useUserStatus()
  const [newChannelName, setNewChannelName] = useState('')
  const [showNewDM, setShowNewDM] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showMemberSearch, setShowMemberSearch] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [showAIChat, setShowAIChat] = useState(false)
  const [showAllChannels, setShowAllChannels] = useState(false)
  const [showAllDMs, setShowAllDMs] = useState(false)
  const { toast } = useToast()
  const { channels, isLoading: isLoadingChannels, createChannel } = useChannels(workspace?.id)
  const { recentChats, isLoading: isLoadingDMs, refreshChats } = useDirectMessages(workspace?.id, null)
  const [displayProfile, setDisplayProfile] = useState(profile)
  const { members, isLoading: isLoadingMembers } = useWorkspaceMembers(workspace?.id || null)

  const visibleChannels = useMemo(() => {
    return showAllChannels ? channels : channels.slice(0, 5)
  }, [channels, showAllChannels])

  const visibleDMs = useMemo(() => {
    return showAllDMs ? recentChats : recentChats.slice(0, 5)
  }, [recentChats, showAllDMs])

  const filteredMembers = useMemo(() => {
    if (!members) return []
    if (!memberSearchQuery.trim()) return members
    
    const query = memberSearchQuery.toLowerCase().trim()
    return members.filter(member => 
      member.username?.toLowerCase().includes(query) || 
      member.email?.toLowerCase().includes(query)
    )
  }, [members, memberSearchQuery])

  useEffect(() => {
    setDisplayProfile(profile)
  }, [profile])

  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent<UserProfile>) => {
      if (event.detail.id === profile?.id) {
        setDisplayProfile(event.detail)
      }
    }

    window.addEventListener('profileUpdated', handleProfileUpdate as EventListener)
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener)
    }
  }, [profile?.id])

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
    refreshChats()
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b bg-white z-50 w-full">
        <div className="h-full flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
              {workspace && <h1 className="text-xl font-semibold">{workspace.name}</h1>}
            </div>
          </div>
          <div className="flex-1 max-w-2xl mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search messages..." 
                className="w-full pl-10 h-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => onTabChange('manage')}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Manage Channels
            </Button>
            <Button
              variant="ghost"
              onClick={() => onTabChange('admin')}
              className="flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Simplified Sidebar */}
        <aside className={`border-r ${isCollapsed ? 'w-20' : 'w-96'} transition-all duration-200 flex flex-col`}>
          <ScrollArea className="flex-1">
            <div className="px-2 py-4 space-y-4">
              {/* Channels Section */}
              <div>
                <h2 className={`text-lg font-semibold px-2 mb-2 ${isCollapsed ? 'text-center' : ''}`}>
                  {isCollapsed ? '#' : 'Channels'}
                </h2>
                <div className="space-y-1">
                  {isLoadingChannels ? (
                    <div className="text-sm text-muted-foreground px-2">Loading channels...</div>
                  ) : channels.length === 0 ? (
                    <div className="text-sm text-muted-foreground px-2">No channels yet</div>
                  ) : (
                    <>
                      {visibleChannels.map((channel) => (
                        <Button
                          key={channel.id}
                          variant="ghost"
                          className="w-full justify-start px-2 hover:bg-[#3A2E6E]/10"
                          onClick={() => onSelectChannel(channel.id)}
                        >
                          <Hash className="mr-2 h-4 w-4 shrink-0" />
                          {!isCollapsed && <span className="truncate">{channel.name}</span>}
                        </Button>
                      ))}
                      {!isCollapsed && channels.length > 5 && (
                        <Button
                          variant="ghost"
                          className="w-full justify-center text-sm text-muted-foreground hover:text-foreground"
                          onClick={() => setShowAllChannels(!showAllChannels)}
                        >
                          {showAllChannels ? 'Show Less' : `Show ${channels.length - 5} More`}
                        </Button>
                      )}
                    </>
                  )}
                  {!isCollapsed && (
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
                  )}
                </div>
              </div>

              {/* Direct Messages Section */}
              <div>
                <h2 className={`text-lg font-semibold px-2 mb-2 ${isCollapsed ? 'text-center' : ''}`}>
                  {isCollapsed ? '@' : 'Direct Messages'}
                </h2>
                <div className="space-y-1">
                  {isLoadingDMs && (
                    <div className="text-sm text-muted-foreground px-2">Loading chats...</div>
                  )}
                  {!isLoadingDMs && recentChats.length === 0 && (
                    <div className="text-sm text-muted-foreground px-2">No direct messages yet</div>
                  )}
                  {!isLoadingDMs && recentChats.length > 0 && (
                    <>
                      {visibleDMs.map((chat) => (
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
                            {!isCollapsed && <span className="truncate">{chat.username}</span>}
                          </div>
                        </Button>
                      ))}
                      {!isCollapsed && recentChats.length > 5 && (
                        <Button
                          variant="ghost"
                          className="w-full justify-center text-sm text-muted-foreground hover:text-foreground"
                          onClick={() => setShowAllDMs(!showAllDMs)}
                        >
                          {showAllDMs ? 'Show Less' : `Show ${recentChats.length - 5} More`}
                        </Button>
                      )}
                    </>
                  )}
                  {!isCollapsed && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start px-2 hover:bg-[#3A2E6E]/10"
                      onClick={handleAddDM}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      <span>New Message</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* User Menu */}
          <div className="border-t p-2 mt-auto">
            <UserMenu onOpenProfileSettings={onOpenProfileSettings} isCollapsed={isCollapsed} />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
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

      {/* Floating AI Chat Button */}
      <Button
        onClick={() => setShowAIChat(!showAIChat)}
        className="fixed bottom-6 right-6 bg-[#3A2E6E] hover:bg-[#2A2154] text-white rounded-full p-3 shadow-lg z-20"
      >
        <Bot className="h-6 w-6" />
      </Button>

      {/* AI Chat Window */}
      {showAIChat && workspace && (
        <div className="fixed inset-0 z-10 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-4 bg-background border rounded-lg shadow-lg overflow-hidden">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowAIChat(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <AIChatWindow workspaceId={workspace.id} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

