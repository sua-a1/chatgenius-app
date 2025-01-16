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
import { ChevronDown, X, Trash2, Hash } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

interface ChannelManagementProps {
  workspace: Workspace | null;
}

export function ChannelManagement({ workspace }: ChannelManagementProps) {
  const { profile } = useAuth()
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

  if (!workspace) {
    return <div className="p-4">Please select a workspace to manage channels.</div>
  }

  if (isLoadingChannels) {
    return <div className="p-4">Loading channels...</div>
  }

  if (channels.length === 0) {
    return <div className="p-4">No channels found in this workspace.</div>
  }

  // Check if user is owner or admin, or owns any channels
  const canManageAnyChannels = isAdmin || channels.some(channel => profile && channel.created_by === profile.id)
  if (!canManageAnyChannels) {
    return <div className="p-4">You need admin permissions to manage channels.</div>
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Channel Management</h2>
      <div className="flex space-x-4">
        <div className="w-1/3">
          <h3 className="text-lg font-semibold mb-2">Channels</h3>
          <ScrollArea className="h-[400px] border rounded p-2">
            {channels.map(channel => (
              <Button 
                key={channel.id}
                variant={selectedChannel?.id === channel.id ? "default" : "ghost"}
                className="w-full justify-start mb-2"
                onClick={() => handleSelectChannel(channel)}
              >
                <div className="flex items-center">
                  <Hash className="mr-2 h-4 w-4" />
                  <span>{channel.name}</span>
                  {channel.is_private && (
                    <span className="ml-2 text-xs bg-secondary px-1 rounded">Private</span>
                  )}
                </div>
              </Button>
            ))}
          </ScrollArea>
        </div>

        <div className="w-2/3">
          {selectedChannel ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">#{selectedChannel.name}</h3>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="private">Private</Label>
                  <Switch
                    id="private"
                    checked={selectedChannel.is_private}
                    onCheckedChange={handleTogglePrivacy}
                  />
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
                      </DialogHeader>
                      <ScrollArea className="h-[300px] border rounded p-2">
                        {workspaceMembers.map(member => {
                          const isMember = channelMembers.some(cm => cm.id === member.id)
                          return (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-2 hover:bg-accent rounded"
                            >
                              <div>
                                <div className="font-medium">{member.username || member.email}</div>
                                <div className="text-sm text-muted-foreground">{member.email}</div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleMember(member.id)}
                              >
                                {isMember ? 'Remove' : 'Add'}
                              </Button>
                            </div>
                          )
                        })}
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>

                <ScrollArea className="h-[300px] border rounded p-2">
                  {channelMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 hover:bg-accent rounded">
                      <div>
                        <div className="font-medium">{member.username || member.email}</div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleMember(member.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Delete Channel</Button>
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
                    <AlertDialogAction onClick={() => deleteChannel(selectedChannel.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a channel to manage
            </div>
          )}
        </div>
      </div>
      </div>
  )
}

