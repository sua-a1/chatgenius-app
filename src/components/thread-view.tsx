'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useUserStatus } from '@/contexts/user-status-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { Edit, MoreVertical, Trash, ArrowUpRight, ArrowLeft, X } from 'lucide-react'
import { MessageReactions } from './message-reactions'
import { Message } from '@/types'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import { UserProfileDisplay } from './user-profile-display'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { FilePreview } from '@/components/ui/file-preview'
import { MessageComposer } from '@/components/message-composer'

interface ThreadMessage extends Message {
  threadDepth: number
  workspace_id: string
}

interface ThreadViewProps {
  parentMessage: Message & { workspace_id: string }
  onClose: () => void
  sendMessage: (content: string, replyTo: string) => Promise<boolean>
  loadThreadMessages: (messageId: string) => Promise<Message[]>
  updateMessage: (messageId: string, content: string) => Promise<boolean>
  deleteMessage: (messageId: string) => Promise<boolean>
}

export default function ThreadView({ 
  parentMessage, 
  onClose, 
  sendMessage: sendMessageProp, 
  loadThreadMessages,
  updateMessage,
  deleteMessage
}: ThreadViewProps) {
  const { profile } = useAuth()
  const { userStatuses } = useUserStatus()
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [threadStack, setThreadStack] = useState<ThreadMessage[]>([{
    ...parentMessage,
    threadDepth: 0
  }])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const MAX_DISPLAY_DEPTH = 3
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null)

  const currentThreadParent = threadStack[threadStack.length - 1]

  useEffect(() => {
  const loadMessages = async () => {
      const threadMessages = await loadThreadMessages(currentThreadParent.id)
      
      // First, create a map of messages for easy lookup
      const messageMap = new Map<string, ThreadMessage>()
      threadMessages.forEach(message => messageMap.set(message.id, { 
        ...message, 
        threadDepth: 0,
        workspace_id: parentMessage.workspace_id
      } as ThreadMessage))

      // Then calculate depths by following reply chains
      threadMessages.forEach(message => {
      let depth = 0
        let currentId = message.reply_to
        let parentMessage = currentId ? messageMap.get(currentId) : null

        while (parentMessage && currentId !== currentThreadParent.id) {
        depth++
          currentId = parentMessage.reply_to
          parentMessage = currentId ? messageMap.get(currentId) : null
        }

        const messageWithDepth = messageMap.get(message.id)!
        messageWithDepth.threadDepth = depth
      })

      setMessages(Array.from(messageMap.values()))
    }
    loadMessages()
  }, [currentThreadParent.id, loadThreadMessages, parentMessage.workspace_id])

  // Reset thread stack when parent message changes
  useEffect(() => {
    setThreadStack([{
      ...parentMessage,
      threadDepth: 0
    }])
    setMessages([])
    setEditingMessage(null)
    setEditContent('')
    setReplyingTo(null)
  }, [parentMessage.id])

  const handleStartEdit = (messageId: string, content: string) => {
    setEditingMessage(messageId)
    setEditContent(content)
  }

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return
    const success = await updateMessage(messageId, editContent)
    if (success) {
      const threadMessages = await loadThreadMessages(currentThreadParent.id)
      const messagesWithDepth = threadMessages.map(message => ({
        ...message,
        threadDepth: 0,
        workspace_id: parentMessage.workspace_id
      })) as ThreadMessage[]
      setMessages(messagesWithDepth)
      setEditingMessage(null)
      setEditContent('')
    }
  }

  const handleCancelEdit = () => {
    setEditingMessage(null)
    setEditContent('')
  }

  const handleReplyClick = (message: ThreadMessage) => {
    setReplyingTo(message)
  }

  const handleShowReplies = (message: ThreadMessage) => {
    // Open a new thread view with this message as parent
    setThreadStack(prev => [...prev, { ...message, threadDepth: prev.length }])
  }

  const navigateToStackIndex = (index: number) => {
    setThreadStack(prev => prev.slice(0, index + 1))
  }

  return (
    <div className="flex flex-col h-full border-l">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          {threadStack.length > 1 && (
            <div className="flex items-center space-x-2">
              {threadStack.map((stackMessage, index) => (
                <div key={stackMessage.id} className="flex items-center">
                  {index > 0 && <ArrowLeft className="h-4 w-4 mx-1" />}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateToStackIndex(index)}
                    className="text-sm font-medium hover:underline"
                  >
                    {stackMessage.user?.username}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <h3 className="text-lg font-semibold">Thread</h3>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Parent Message */}
          <div className="flex flex-col space-y-2">
            <UserProfileDisplay
              user={{
                id: currentThreadParent.user?.id || '',
                username: currentThreadParent.user?.username || 'Unknown User',
                avatar_url: currentThreadParent.user?.avatar_url,
                created_at: currentThreadParent.created_at
              }}
              showDMButton={false}
            >
              <div className="flex items-center space-x-2">
                <Avatar 
                  className="h-8 w-8"
                  status={userStatuses.get(currentThreadParent.user?.id || '')}
                >
                  <AvatarImage src={currentThreadParent.user?.avatar_url || undefined} />
                  <AvatarFallback>{currentThreadParent.user?.username?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex items-baseline space-x-2">
                  <span className="font-medium">{currentThreadParent.user?.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(currentThreadParent.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </UserProfileDisplay>
            <div className="pl-10">
              <p className="text-sm mb-2">{currentThreadParent.content}</p>
              {currentThreadParent.attachments && currentThreadParent.attachments.length > 0 && (
                <FilePreview attachments={currentThreadParent.attachments} />
              )}
              <MessageReactions messageId={currentThreadParent.id} />
            </div>
          </div>

          {/* Thread Messages */}
          <div className="space-y-4 mt-4 ml-6 pl-4 border-l-2 border-l-muted">
            {messages
              .filter(message => {
                // Find the root parent of this message in the current thread
                let currentId = message.reply_to
                let parentMessage = currentId ? messages.find(m => m.id === currentId) : null
                let depth = 0

                while (parentMessage && currentId !== currentThreadParent.id) {
                  depth++
                  currentId = parentMessage.reply_to
                  parentMessage = currentId ? messages.find(m => m.id === currentId) : null
                }

                // Show the message if:
                // 1. It's a direct reply to current thread parent (depth = 0)
                // 2. It's a nested reply with depth <= 2
                // 3. Its reply chain leads back to current thread parent
                return currentId === currentThreadParent.id && depth <= 2
              })
              .sort((a, b) => {
                // First sort by the reply chain (keep replies after their parents)
                const aParentId = a.reply_to
                const bParentId = b.reply_to
                if (aParentId === currentThreadParent.id && bParentId !== currentThreadParent.id) return -1
                if (aParentId !== currentThreadParent.id && bParentId === currentThreadParent.id) return 1
                
                // Then sort by creation date within the same level
                if (aParentId === bParentId) {
                  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                }

                // Keep replies close to their parents
                const aParent = messages.find(m => m.id === aParentId)
                const bParent = messages.find(m => m.id === bParentId)
                if (aParent && bParent) {
                  return new Date(aParent.created_at).getTime() - new Date(bParent.created_at).getTime()
                }
                return 0
              })
              .map(message => (
                <div 
                  key={message.id} 
                  className={`flex flex-col space-y-2 ${message.threadDepth > 0 ? 'ml-6' : ''}`}
                >
                  <UserProfileDisplay
                    user={{
                      id: message.user?.id || '',
                      username: message.user?.username || 'Unknown User',
                      avatar_url: message.user?.avatar_url,
                      created_at: message.created_at
                    }}
                    showDMButton={false}
                  >
                    <div className="flex items-center space-x-2">
                      <Avatar 
                        className="h-8 w-8"
                        status={userStatuses.get(message.user?.id || '')}
                      >
                        <AvatarImage src={message.user?.avatar_url || undefined} />
                        <AvatarFallback>{message.user?.username?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex items-baseline space-x-2">
                        <span className="font-medium">{message.user?.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </UserProfileDisplay>
                  <div className="pl-10">
                    {editingMessage === message.id ? (
                      <div className="flex items-center space-x-2">
                        <Input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={() => handleSaveEdit(message.id)}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between group">
                          <p className="text-sm mb-2">{message.content}</p>
                          {message.user?.id === profile?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleStartEdit(message.id, message.content)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => deleteMessage(message.id)}
                                >
                                  <Trash className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        {message.attachments && message.attachments.length > 0 && (
                          <FilePreview attachments={message.attachments} />
                        )}
                        <div className="flex items-center space-x-4 mt-2">
                          <MessageReactions messageId={message.id} />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleReplyClick(message)}
                          >
                            Reply
                          </Button>
                          {message.reply_count > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleShowReplies(message)}
                            >
                              {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'} <ArrowUpRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t p-4">
        {replyingTo && (
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>
              Replying to {replyingTo.user?.username}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 hover:text-foreground"
              onClick={() => setReplyingTo(null)}
            >
              Cancel
            </Button>
          </div>
        )}
        <div className="flex space-x-2">
          <MessageComposer
            onSendMessage={async (content, attachments) => {
              const success = await sendMessageProp(
                content, 
                replyingTo ? replyingTo.id : parentMessage.id
              )
              if (success) {
                setReplyingTo(null)
                const threadMessages = await loadThreadMessages(currentThreadParent.id)
                const messagesWithDepth = threadMessages.map(message => ({
                  ...message,
                  threadDepth: 0,
                  workspace_id: parentMessage.workspace_id
                })) as ThreadMessage[]
                setMessages(messagesWithDepth)
                return true
              }
              return false
            }}
            placeholder={replyingTo ? `Reply to ${replyingTo.user?.username}...` : "Reply to thread..."}
            workspaceId={parentMessage.workspace_id}
            channelId={parentMessage.channel_id}
            userId={profile?.id || ''}
          />
        </div>
      </div>
    </div>
  )
} 