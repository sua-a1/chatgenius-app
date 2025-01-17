'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useDirectMessages } from '@/hooks/use-direct-messages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { Edit, MoreVertical, Trash, X } from 'lucide-react'
import { MessageReactions } from './message-reactions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { FileUpload } from './ui/file-upload'
import { FilePreview } from './ui/file-preview'
import { UserAvatar, UserName } from '@/components/ui/user-avatar'
import { useUserStatus } from '@/contexts/user-status-context'
import { UserProfileDisplay } from '@/components/user-profile-display'
import { Workspace } from '@/types'
import { useToast } from '@/hooks/use-toast'

interface DirectMessageAreaProps {
  workspace: {
    id: string
  } | null
  selectedUserId: string | null
  onClose?: () => void
}

export default function DirectMessageArea({ workspace, selectedUserId, onClose }: DirectMessageAreaProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { messages, isLoading, sendMessage, deleteMessage, selectedUser } = useDirectMessages(workspace?.id, selectedUserId)
  const [newMessage, setNewMessage] = useState('')
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const lastMessageId = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { userStatuses } = useUserStatus()

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && selectedFiles.length === 0) || !selectedUserId) return

    try {
      const success = await sendMessage(newMessage.trim(), selectedFiles)
      if (success) {
        setNewMessage('')
        setSelectedFiles([])
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex flex-col h-full">
      {!workspace || !selectedUserId || !user ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          {!user ? 'Loading...' : 'Select a user to start chatting'}
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="border-b p-4">
            {selectedUser ? (
              <UserProfileDisplay 
                user={selectedUser}
              >
                <div className="flex items-center space-x-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedUser.avatar_url || undefined} />
                    <AvatarFallback>{selectedUser.username[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-semibold">{selectedUser.username}</span>
                    {selectedUser.full_name && (
                      <span className="text-sm text-muted-foreground">{selectedUser.full_name}</span>
                    )}
                  </div>
                </div>
              </UserProfileDisplay>
            ) : (
              <div className="flex items-center space-x-2">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>?</AvatarFallback>
                </Avatar>
                <span className="font-semibold">Loading...</span>
              </div>
            )}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-sm text-muted-foreground">Loading messages...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-sm text-muted-foreground">No messages yet. Start a conversation!</span>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`group flex items-start space-x-2 ${
                      message.sender_id === selectedUserId ? 'flex-row' : 'flex-row-reverse space-x-reverse'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <UserAvatar 
                        user={message.sender}
                        size="sm"
                        status={userStatuses.get(message.sender_id)}
                        showDMButton={false}
                        className="mt-1"
                      />
                    </div>
                    <div className={`flex flex-col ${message.sender_id === selectedUserId ? 'items-start' : 'items-end'}`}>
                      <div className="flex items-center space-x-2">
                        <UserName
                          user={message.sender}
                          showDMButton={false}
                          className="text-sm font-medium"
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div
                          className={`mt-1 px-3 py-2 rounded-lg ${
                            message.sender_id === selectedUserId
                              ? 'bg-accent'
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          {message.content}
                        </div>
                        {message.attachments && message.attachments.length > 0 && (
                          <FilePreview attachments={message.attachments} />
                        )}
                        {message.sender_id === user.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteMessage(message.id)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="border-t p-4">
            <div className="flex flex-col gap-2">
              <div className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="submit" disabled={!newMessage.trim() && selectedFiles.length === 0}>
                  Send
                </Button>
              </div>
              {selectedFiles.length > 0 && (
                <FilePreview
                  attachments={selectedFiles.map(url => ({
                    url,
                    filename: url.split('/').pop() || 'unknown'
                  }))}
                />
              )}
              <FileUpload
                workspaceId={workspace.id}
                directMessageId={selectedUserId}
                userId={user.id}
                onFilesSelected={urls => setSelectedFiles(urls)}
                disabled={!selectedUserId}
              />
            </div>
          </form>
        </>
      )}
    </div>
  )
}

