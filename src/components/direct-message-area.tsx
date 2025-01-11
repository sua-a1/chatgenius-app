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

interface DirectMessageAreaProps {
  workspace: {
    id: string
  } | null
  selectedUserId: string | null
  onClose?: () => void
}

export default function DirectMessageArea({ workspace, selectedUserId, onClose }: DirectMessageAreaProps) {
  const { profile } = useAuth()
  const { userStatuses } = useUserStatus()
  const { messages, selectedUser, isLoading, sendMessage, deleteMessage, editMessage } = useDirectMessages(workspace?.id, selectedUserId)
  const [newMessage, setNewMessage] = useState('')
  const [editingMessage, setEditingMessage] = useState<{ id: string, content: string } | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lastMessageRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)
  const lastMessageId = useRef<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])

  // Scroll to bottom only on initial load and new messages from the current user
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      
      // Only scroll if this is a new message (not just a reload)
      if (lastMessage.id !== lastMessageId.current) {
        const shouldScroll = isInitialLoad.current || lastMessage.sender_id === profile?.id
        
        if (shouldScroll) {
          requestAnimationFrame(() => {
            lastMessageRef.current?.scrollIntoView({
              behavior: isInitialLoad.current ? 'instant' : 'smooth',
              block: 'end',
            })
          })
        }

        lastMessageId.current = lastMessage.id
      }

      if (isInitialLoad.current) {
        isInitialLoad.current = false
      }
    }
  }, [messages, isLoading, profile?.id])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() && selectedFiles.length === 0) return
    if (!selectedUserId || !workspace) return

    const messageContent = newMessage.trim()
    setNewMessage('') // Clear input immediately
    const success = await sendMessage(messageContent, selectedFiles)
    if (!success) {
      setNewMessage(messageContent) // Restore message if send failed
    } else {
      setSelectedFiles([]) // Clear files after successful send
    }
  }

  const handleStartEdit = (messageId: string, content: string) => {
    setEditingMessage({ id: messageId, content })
  }

  const handleSaveEdit = async (messageId: string, newContent: string) => {
    const success = await editMessage(messageId, newContent)
    if (success) {
      setEditingMessage(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingMessage(null)
  }

  const handleStartDM = (userId: string) => {
    // In DM area, we might want to handle this differently or disable it
    console.log('Start DM with user:', userId)
  }

  if (!workspace || !selectedUserId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a user to start chatting
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-2">
        {selectedUser && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UserAvatar 
                user={selectedUser}
                size="sm"
                status={userStatuses.get(selectedUser.id)}
                showDMButton={false}
              />
              <UserName
                user={selectedUser}
                showDMButton={false}
                className="font-semibold"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (selectedUserId) {
                  window.history.pushState({}, '', `/app/workspaces/${workspace?.id}`);
                  onClose?.();
                }
              }}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No messages yet
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {messages.map((message, index) => {
              const previousMessage = index > 0 ? messages[index - 1] : null
              const isFirstMessageFromUser = !previousMessage || previousMessage.sender_id !== message.sender_id
              const timeDiff = previousMessage 
                ? new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime()
                : 0
              const shouldShowHeader = isFirstMessageFromUser || timeDiff > 300000 // 5 minutes
              const isLastMessage = index === messages.length - 1

              return (
                <div
                  key={message.id}
                  ref={isLastMessage ? lastMessageRef : undefined}
                  className="group hover:bg-accent/5 -mx-4 px-4 py-1 rounded"
                >
                  {shouldShowHeader && (
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="flex items-center space-x-2">
                        <UserAvatar 
                          user={message.sender}
                          size="sm"
                          status={userStatuses.get(message.sender.id)}
                          showDMButton={false}
                        />
                        <div className="flex items-baseline space-x-2">
                          <UserName
                            user={message.sender}
                            showDMButton={false}
                            className="font-semibold"
                          />
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start pl-12">
                    <div className="flex-1">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-start group/message">
                          {editingMessage?.id === message.id ? (
                            <div className="flex-1 flex items-center gap-2">
                              <Input
                                value={editingMessage.content}
                                onChange={(e) => setEditingMessage({ id: message.id, content: e.target.value })}
                                className="flex-1"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(message.id, editingMessage.content)}
                                disabled={!editingMessage.content.trim() || editingMessage.content === message.content}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelEdit}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <p className="flex-1 text-sm leading-relaxed">
                                {message.content}
                              </p>
                              {message.sender_id === profile?.id && (
                                <div className="opacity-0 group-hover/message:opacity-100 transition-opacity">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleStartEdit(message.id, message.content)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => deleteMessage(message.id)}>
                                        <Trash className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {message.attachments && message.attachments.length > 0 && (
                          <FilePreview attachments={message.attachments} />
                        )}
                        {!message.id.toString().startsWith('temp-') && (
                          <MessageReactions messageId={message.id} isDirect />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSendMessage} className="border-t p-4">
        <div className="flex flex-col gap-2">
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={`Message ${selectedUser?.username}`}
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
          {workspace && (
            <FileUpload
              workspaceId={workspace.id}
              onFilesSelected={urls => setSelectedFiles(urls)}
              disabled={!selectedUserId}
            />
          )}
        </div>
      </form>
    </div>
  )
}

