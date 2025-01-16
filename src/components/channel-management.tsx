'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Workspace, Channel, User } from '@/types'
import { useChannels } from '@/hooks/use-channels'
import { useChannelManagement } from '@/hooks/use-channel-management'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, X, Trash2 } from 'lucide-react'

interface ChannelManagementProps {
  workspace: Workspace | null;
  onTabChange: (tab: string) => void;
}

export function ChannelManagement({ workspace, onTabChange }: ChannelManagementProps) {
  const { channels, isLoading: isLoadingChannels, deleteChannel } = useChannels(workspace?.id)
  const { 
    isAdmin, 
    channelMembers, 
    workspaceMembers,
    isLoadingChannel,
    isLoadingWorkspace,
    loadChannelMembers,
    addMember,
    removeMember,
    updateChannelPrivacy,
    updateMemberRole,
  } = useChannelManagement(workspace?.id, channels)
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const { toast } = useToast()

  // Load channel members when a channel is selected
  useEffect(() => {
    if (selectedChannel) {
      loadChannelMembers(selectedChannel.id)
    }
  }, [selectedChannel])

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel)
  }

  const handleToggleMember = async (userId: string) => {
    if (!selectedChannel) return

    const isMember = channelMembers.some(member => member.id === userId)
    if (isMember) {
      await removeMember(selectedChannel.id, userId)
    } else {
      await addMember(selectedChannel.id, userId)
    }
  }

  const handleTogglePrivacy = async () => {
    if (!selectedChannel) return

    const success = await updateChannelPrivacy(selectedChannel.id, !selectedChannel.is_private)
    if (success) {
      setSelectedChannel({
        ...selectedChannel,
        is_private: !selectedChannel.is_private
      })
    }
  }

  const handleAddMembers = async () => {
    if (!selectedChannel || selectedMemberIds.length === 0) return

    let successCount = 0
    for (const userId of selectedMemberIds) {
      const success = await addMember(selectedChannel.id, userId)
      if (success) successCount++
    }

    if (successCount > 0) {
      toast({
        title: 'Members added',
        description: `Successfully added ${successCount} member${successCount > 1 ? 's' : ''} to the channel.`,
      })
      setSelectedMemberIds([])
      setShowAddMemberDialog(false)
    }
  }

  const toggleMemberSelection = (userId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const nonMembers = workspaceMembers.filter(
    member => !channelMembers.some(cm => cm.id === member.id)
  )

  const handleDeleteChannel = async (channelId: string) => {
    if (!workspace || !isAdmin) return
    const success = await deleteChannel(channelId)
    if (success) {
      setSelectedChannel(null)
      toast({
        title: 'Channel deleted',
        description: 'The channel has been successfully deleted.',
      })
    }
  }

  if (!workspace) {
    return <div className="p-4">Please select a workspace to manage channels.</div>
  }

  if (!isAdmin) {
    return <div className="p-4">You need admin permissions to manage channels.</div>
  }

  return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Channel Management</h2>
        </div>
        <div className="flex space-x-4">
          <div className="w-1/3">
            <h3 className="text-lg font-semibold mb-2">Channels</h3>
            <ScrollArea className="h-[400px] border rounded p-2">
              {isLoadingChannels ? (
                <div className="text-center p-4">Loading channels...</div>
              ) : channels.length === 0 ? (
                <div className="text-center p-4">No channels found</div>
              ) : (
                channels.map(channel => (
                  <div key={channel.id} className="flex items-center justify-between mb-2 hover:bg-accent rounded-md">
                    <Button 
                      variant={selectedChannel?.id === channel.id ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => handleSelectChannel(channel)}
                    >
                      <div className="flex items-center">
                        <span className="mr-2">#</span>
                        <span>{channel.name}</span>
                        {channel.is_private && (
                          <span className="ml-2 text-xs bg-secondary px-1 rounded">Private</span>
                        )}
                      </div>
                    </Button>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>

          <div className="w-2/3">
            {selectedChannel ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">#{selectedChannel.name}</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="private">Private</Label>
                      <Switch
                        id="private"
                        checked={selectedChannel.is_private}
                        onCheckedChange={handleTogglePrivacy}
                      />
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Channel
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Channel</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete #{selectedChannel.name}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteChannel(selectedChannel.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">Members</h4>
                    <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Add Members
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Members to #{selectedChannel.name}</DialogTitle>
                          <p className="text-sm text-muted-foreground">
                            Select workspace members to add to this channel. Members will have access to all channel messages and files.
                          </p>
                        </DialogHeader>
                        <div className="py-4">
                          <ScrollArea className="h-[300px] pr-4">
                            {nonMembers.length === 0 ? (
                              <div className="text-center text-muted-foreground">
                                No workspace members available to add
                              </div>
                            ) : (
                              nonMembers.map(member => (
                                <div
                                  key={member.id}
                                  className="flex items-center space-x-2 mb-2"
                                >
                                  <Switch
                                    checked={selectedMemberIds.includes(member.id)}
                                    onCheckedChange={() => toggleMemberSelection(member.id)}
                                  />
                                  <div>
                                    <div className="font-medium">{member.username}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {member.email}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </ScrollArea>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedMemberIds([])
                              setShowAddMemberDialog(false)
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddMembers}
                            disabled={selectedMemberIds.length === 0}
                          >
                            Add Selected
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <ScrollArea className="h-[300px] border rounded p-2">
                    {isLoadingChannel || isLoadingWorkspace ? (
                      <div className="text-center p-4">Loading members...</div>
                    ) : channelMembers.length === 0 ? (
                      <div className="text-center p-4">No members found</div>
                    ) : (
                      channelMembers.map(member => (
                        <div key={member.id} className="flex justify-between items-center p-2">
                          <div>
                            <div className="font-medium">{member.username}</div>
                            <div className="text-sm text-muted-foreground">{member.email}</div>
                            <div className="text-xs text-muted-foreground">
                              {member.role}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  Role <ChevronDown className="ml-1 h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem
                                  onClick={() => updateMemberRole(member.id, 'member')}
                                  disabled={member.role === 'member'}
                                >
                                  Member
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateMemberRole(member.id, 'admin')}
                                  disabled={member.role === 'admin'}
                                >
                                  Admin
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleMember(member.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a channel to manage its settings
              </div>
            )}
          </div>
        </div>
      </div>
  )
}

