'use client'

import React from 'react'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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
import { UserAvatar, UserName } from '@/components/ui/user-avatar'
import type { UserStatus } from '@/components/ui/avatar'

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

// Memoized thread message component
const ThreadMessage = React.memo(({ 
  message,
  userStatus,
  isCurrentUser,
  onReply,
  onShowReplies,
  onStartEdit,
  onDelete,
  isInStack = false
}: {
  message: ThreadMessage
  userStatus?: UserStatus
  isCurrentUser: boolean
  onReply: (message: ThreadMessage) => void
  onShowReplies: (message: ThreadMessage) => void
  onStartEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
  isInStack?: boolean
}) => (
  <div className={`flex flex-col space-y-2 ${message.threadDepth > 0 ? 'ml-6' : ''}`}>
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
          status={userStatus}
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
    <div className="pl-10 group">
      <p className="text-sm mb-2">{message.content}</p>
      {message.attachments && message.attachments.length > 0 && (
        <FilePreview attachments={message.attachments} />
      )}
      <div className="flex items-center space-x-4 mt-2">
        <MessageReactions messageId={message.id} />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onReply(message)}
        >
          Reply
        </Button>
        {message.reply_count > 0 && !isInStack && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onShowReplies(message)}
          >
            {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'} <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        )}
        {isCurrentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStartEdit(message.id, message.content)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => onDelete(message.id)}
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  </div>
))
ThreadMessage.displayName = 'ThreadMessage'

// Add memoized thread stack navigation component
const ThreadStackNavigation = React.memo(({ 
  threadStack, 
  onNavigate 
}: { 
  threadStack: ThreadMessage[]
  onNavigate: (index: number) => void 
}) => (
  <div className="flex items-center space-x-2">
    {threadStack.map((stackMessage, index) => (
      <div key={stackMessage.id} className="flex items-center">
        {index > 0 && <ArrowLeft className="h-4 w-4 mx-1" />}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate(index)}
          className="text-sm font-medium hover:underline"
        >
          {stackMessage.user?.username}
        </Button>
      </div>
    ))}
  </div>
))
ThreadStackNavigation.displayName = 'ThreadStackNavigation'

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
  const [isLoading, setIsLoading] = useState(true)
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [threadStack, setThreadStack] = useState<ThreadMessage[]>([{
    ...parentMessage,
    threadDepth: 0
  }])
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const currentThreadParent = useMemo(() => threadStack[threadStack.length - 1], [threadStack])

  // Create a memoized message map for faster lookups
  const messageMap = useMemo(() => {
    const map = new Map<string, ThreadMessage>()
    messages.forEach(message => map.set(message.id, message))
    return map
  }, [messages])

  // Memoize callbacks
  const handleReplyClick = useCallback((message: ThreadMessage) => {
    setReplyingTo(message)
  }, [])

  const handleShowReplies = useCallback((message: ThreadMessage) => {
    setThreadStack(prev => [...prev, { ...message, threadDepth: prev.length }])
  }, [])

  const handleStartEdit = useCallback((messageId: string, content: string) => {
    setEditingMessage(messageId)
    setEditContent(content)
  }, [])

  const handleDelete = useCallback((messageId: string) => {
    deleteMessage(messageId)
  }, [deleteMessage])

  const navigateToStackIndex = useCallback((index: number) => {
    setThreadStack(prev => prev.slice(0, index + 1))
  }, [])

  // Update the message processing function to be more efficient
  const processMessages = useCallback((threadMessages: Message[]) => {
    // Create a map for direct lookups instead of repeated array searches
    const messageMap = new Map<string, ThreadMessage>()
    const depthMap = new Map<string, number>()
    
    // First pass: Identify direct replies (depth 1)
    threadMessages.forEach(message => {
      if (message.reply_to === currentThreadParent.id) {
        depthMap.set(message.id, 1)
        messageMap.set(message.id, {
          ...message,
          threadDepth: 1,
          workspace_id: parentMessage.workspace_id
        })
      }
    })
    
    // Second pass: Identify replies to direct replies (depth 2)
    threadMessages.forEach(message => {
      if (!depthMap.has(message.id) && message.reply_to) {
        const parent = messageMap.get(message.reply_to)
        if (parent && parent.threadDepth === 1) {
          depthMap.set(message.id, 2)
          messageMap.set(message.id, {
            ...message,
            threadDepth: 2,
            workspace_id: parentMessage.workspace_id
          })
        }
      }
    })
    
    return Array.from(messageMap.values())
  }, [currentThreadParent.id, parentMessage.workspace_id])

  // Update the load messages effect to be more efficient
  useEffect(() => {
    let mounted = true
    const loadMessages = async () => {
      if (!mounted) return
      setIsLoading(true)
      
      try {
        const threadMessages = await loadThreadMessages(currentThreadParent.id)
        if (!mounted) return
        
        const processedMessages = processMessages(threadMessages)
        setMessages(processedMessages)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadMessages()

    // Set up real-time subscription with debounced updates
    let timeoutId: NodeJS.Timeout
    const channel = supabase
      .channel(`thread:${currentThreadParent.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `id=eq.${currentThreadParent.id} or reply_to=eq.${currentThreadParent.id}`
      }, () => {
        // Debounce updates to prevent rapid re-renders
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          if (!isLoading && mounted) {
            loadMessages()
          }
        }, 100)
      })
      .subscribe()

    // Set up another subscription for replies to replies
    const repliesChannel = supabase
      .channel(`thread-replies:${currentThreadParent.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `reply_to.in.(${messages.filter(m => m.threadDepth === 1).map(m => m.id).join(',')})`
      }, () => {
        // Debounce updates to prevent rapid re-renders
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          if (!isLoading && mounted) {
            loadMessages()
          }
        }, 100)
      })
      .subscribe()

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      channel.unsubscribe()
      repliesChannel.unsubscribe()
    }
  }, [currentThreadParent.id, loadThreadMessages, processMessages, isLoading, messages])

  // Update the filtered messages memo to be more efficient
  const filteredMessages = useMemo(() => {
    // First, calculate depths for all messages
    const depths = new Map<string, number>()
    const parentId = currentThreadParent.id

    // First pass: Calculate depths for all messages
    messages.forEach(message => {
      if (message.reply_to === parentId) {
        depths.set(message.id, 1) // Direct replies are depth 1
      } else {
        // Check if this is a reply to a depth 1 message
        const parent = messages.find(m => m.id === message.reply_to)
        if (parent && depths.get(parent.id) === 1) {
          depths.set(message.id, 2) // Replies to direct replies are depth 2
        }
      }
    })

    return messages
      .filter(message => {
        const depth = depths.get(message.id)
        // Only show messages that are part of this thread and up to depth 2
        return depth !== undefined && depth <= 2
      })
      .sort((a, b) => {
        // Sort by timestamp
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
  }, [messages, currentThreadParent.id])

  // Add a function to check if a message is in the current thread stack
  const isMessageInStack = useCallback((messageId: string) => {
    return threadStack.some(stackMessage => stackMessage.id === messageId)
  }, [threadStack])

  // Add a function to check if a message's replies are already visible
  const hasVisibleReplies = useCallback((messageId: string) => {
    // Get the depth of this message
    const depth = messages.find(m => m.id === messageId)?.threadDepth || 0
    
    // Only show reply count for depth 2 messages that have replies
    return depth === 2 && messages.some(m => m.reply_to === messageId)
  }, [messages])

  // Add message composer handlers
  const handleSendMessage = useCallback(async (content: string) => {
    const success = await sendMessageProp(content, replyingTo?.id || currentThreadParent.id)
    if (success) {
      setReplyingTo(null)
    }
    return success
  }, [sendMessageProp, replyingTo, currentThreadParent.id])

  const handleSaveEdit = useCallback(async (messageId: string) => {
    if (!editContent.trim()) return
    const success = await updateMessage(messageId, editContent)
    if (success) {
      setEditingMessage(null)
      setEditContent('')
    }
  }, [updateMessage, editContent])

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null)
    setEditContent('')
  }, [])

  return (
    <div className="flex flex-col h-full border-l">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          {threadStack.length > 1 && (
            <ThreadStackNavigation 
              threadStack={threadStack} 
              onNavigate={navigateToStackIndex} 
            />
          )}
          <h3 className="text-lg font-semibold">Thread</h3>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Parent Message */}
          <ThreadMessage 
            message={currentThreadParent}
            userStatus={userStatuses.get(currentThreadParent.user?.id || '')}
            isCurrentUser={currentThreadParent.user?.id === profile?.id}
            onReply={handleReplyClick}
            onShowReplies={handleShowReplies}
            onStartEdit={handleStartEdit}
            onDelete={handleDelete}
            isInStack={true}
          />

          {/* Thread Messages */}
          <div className="space-y-4 mt-4 ml-6 pl-4 border-l-2 border-l-muted">
            {filteredMessages
              .filter(message => message.threadDepth === 1)
              .map(message => (
                <div key={message.id} className="space-y-4">
                  <ThreadMessage 
                    message={message}
                    userStatus={userStatuses.get(message.user?.id || '')}
                    isCurrentUser={message.user?.id === profile?.id}
                    onReply={handleReplyClick}
                    onShowReplies={handleShowReplies}
                    onStartEdit={handleStartEdit}
                    onDelete={handleDelete}
                    isInStack={isMessageInStack(message.id)}
                  />
                  {/* Nested replies */}
                  <div className="ml-6 pl-4 space-y-4 border-l-2 border-l-muted">
                    {filteredMessages
                      .filter(reply => reply.threadDepth === 2 && reply.reply_to === message.id)
                      .map(reply => (
                        <ThreadMessage 
                          key={reply.id}
                          message={reply}
                          userStatus={userStatuses.get(reply.user?.id || '')}
                          isCurrentUser={reply.user?.id === profile?.id}
                          onReply={handleReplyClick}
                          onShowReplies={handleShowReplies}
                          onStartEdit={handleStartEdit}
                          onDelete={handleDelete}
                          isInStack={isMessageInStack(reply.id) || hasVisibleReplies(reply.id)}
                        />
                      ))}
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
        <MessageComposer 
          onSendMessage={handleSendMessage}
          workspaceId={parentMessage.workspace_id}
          userId={profile?.id || ''}
          placeholder={editingMessage ? 'Edit message...' : 'Reply to thread...'}
          disabled={!profile?.id}
          editingContent={editingMessage ? editContent : null}
          onEditChange={setEditContent}
          onSaveEdit={() => editingMessage && handleSaveEdit(editingMessage)}
          onCancelEdit={handleCancelEdit}
        />
      </div>
    </div>
  )
} 