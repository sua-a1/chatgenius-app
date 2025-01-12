"use client";

import { useState, useEffect } from 'react'
import { Workspace, Channel, User } from '@/types/index'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PlusCircle, Hash, MessageSquare, Settings, LogOut, UserIcon } from 'lucide-react'

interface WorkspacePageProps {
  workspace: Workspace;
  onSelectChannel: (channelId: string) => void;
  onSelectDM: (userId: string) => void;
  onOpenProfileSettings: () => void;
  onLogout: () => void;
}

export function WorkspacePage({ 
  workspace, 
  onSelectChannel, 
  onSelectDM, 
  onOpenProfileSettings,
  onLogout
}: WorkspacePageProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [directMessages, setDirectMessages] = useState<User[]>([])
  const [newChannelName, setNewChannelName] = useState('')

  useEffect(() => {
    // Fetch channels and DMs for the workspace
    // This would be an API call in a real application
    setChannels([
      { id: '1', workspace_id: workspace.id, name: 'general', topic: 'General discussion', is_private: false, created_by: '1', created_at: new Date().toISOString() },
      { id: '2', workspace_id: workspace.id, name: 'random', topic: 'Random stuff', is_private: false, created_by: '1', created_at: new Date().toISOString() },
    ])
    setDirectMessages([
      { id: '1', email: 'john@example.com', username: 'John Doe', avatar: '', status: 'online', role: 'member', created_at: new Date().toISOString() },
      { id: '2', email: 'jane@example.com', username: 'Jane Smith', avatar: '', status: 'offline', role: 'admin', created_at: new Date().toISOString() },
    ])
  }, [workspace])

  const handleAddChannel = () => {
    if (newChannelName.trim()) {
      const newChannel: Channel = {
        id: (channels.length + 1).toString(),
        workspace_id: workspace.id,
        name: newChannelName.trim(),
        topic: '',
        is_private: false,
        created_by: '1', // This should be the current user's ID
        created_at: new Date().toISOString(),
      }
      setChannels([...channels, newChannel])
      setNewChannelName('')
    }
  }

  return (
    <div className="w-64 border-r bg-gray-100 flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">{workspace.name}</h2>
      </div>
      <ScrollArea className="flex-grow">
        <div className="p-4">
          <h3 className="mb-2 text-lg font-semibold">Channels</h3>
          {channels.map((channel) => (
            <Button
              key={channel.id}
              variant="ghost"
              className="w-full justify-start mb-1"
              onClick={() => onSelectChannel(channel.id)}
            >
              <Hash className="mr-2 h-4 w-4" />
              {channel.name}
            </Button>
          ))}
          <div className="flex items-center mt-2">
            <Input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="New channel name"
              className="mr-2"
            />
            <Button onClick={handleAddChannel}>
              <PlusCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4">
          <h3 className="mb-2 text-lg font-semibold">Direct Messages</h3>
          {directMessages.map((user) => (
            <Button
              key={user.id}
              variant="ghost"
              className="w-full justify-start mb-1"
              onClick={() => onSelectDM(user.id)}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              {user.username}
            </Button>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <div className="flex items-center mb-4">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/avatars/01.png" alt="@johndoe" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div className="ml-2">
            <p className="text-sm font-medium leading-none">John Doe</p>
            <p className="text-xs text-muted-foreground">john@example.com</p>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" size="icon" onClick={onOpenProfileSettings}>
            <UserIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

