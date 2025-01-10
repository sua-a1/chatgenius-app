import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { Edit, MoreVertical, Trash, ArrowUpRight, ArrowLeft } from 'lucide-react'
import { MessageReactions } from './message-reactions'
import { Message } from '@/types'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'

interface ThreadViewProps {
  parentMessage: Message
  onClose: () => void
  sendMessage: (content: string, replyTo: string) => Promise<boolean>
  loadThreadMessages: (parentMessageId: string) => Promise<Message[]>
  updateMessage: (messageId: string, content: string) => Promise<boolean>
  deleteMessage: (messageId: string) => Promise<boolean>
}

interface ThreadMessage extends Message {
  threadDepth: number
}

export default function ThreadView({ 
  parentMessage, 
  onClose, 
  sendMessage, 
  loadThreadMessages,
  updateMessage,
  deleteMessage 
}: ThreadViewProps) {
  const { profile } = useAuth()
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([])
  const [newReply, setNewReply] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [threadStack, setThreadStack] = useState<Message[]>([parentMessage])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const threadMessageIdsRef = useRef<Set<string>>(new Set([parentMessage.id]))

  const MAX_DISPLAY_DEPTH = 2
  const currentParentMessage = threadStack[threadStack.length - 1]

  useEffect(() => {
    loadMessages()

    console.log('Setting up realtime subscription for thread:', {
      parentId: currentParentMessage.id,
      threadMessageIds: Array.from(threadMessageIdsRef.current)
    })

    // Set up realtime subscription for thread messages
    const channel = supabase
      .channel(`thread:${currentParentMessage.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${currentParentMessage.channel_id}`
        },
        async (payload) => {
          // Check if this message is a reply to any message in our thread
          if (!threadMessageIdsRef.current.has(payload.new.reply_to)) return

          // Get the full message data with user and reactions
          const { data: messageData, error } = await supabase
            .from('messages')
            .select(`
              *,
              user:users(id, username, avatar_url),
              message_reactions_with_users(*)
            `)
            .eq('id', payload.new.id)
            .single()

          if (error || !messageData) return

          // Add the new message to the thread
          setThreadMessages(prev => {
            // Include the new message in our messages array
            const allMessages = [...prev, { 
              ...messageData, 
              threadDepth: 0,
              user: messageData.user,
              reactions: messageData.message_reactions_with_users || [] 
            }]

            // Create a map of replies for each message
            const messageMap = new Map<string, ThreadMessage[]>()
            allMessages.forEach(message => {
              if (message.id === currentParentMessage.id) return // Skip parent message as it's rendered separately
              
              const parentId = message.reply_to || currentParentMessage.id
              const existing = messageMap.get(parentId) || []
              messageMap.set(parentId, [...existing, { ...message, threadDepth: 0 }])
            })

            // Sort each group of replies by timestamp
            messageMap.forEach((replies) => {
              replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            })

            // Process messages with proper depth
            const processedMessages: ThreadMessage[] = []
            const seenMessages = new Set<string>()

            // Helper function to get message depth
            const getMessageDepth = (messageId: string): number => {
              let depth = 0
              let currentId = messageId
              let parentId = allMessages.find(m => m.id === currentId)?.reply_to

              while (parentId && parentId !== currentParentMessage.id) {
                depth++
                currentId = parentId
                parentId = allMessages.find(m => m.id === currentId)?.reply_to
              }
              return depth
            }

            // Process the thread
            const processThread = (parentId: string) => {
              const replies = messageMap.get(parentId) || []
              
              replies.forEach(reply => {
                if (seenMessages.has(reply.id)) return

                const depth = getMessageDepth(reply.id)
                if (depth < MAX_DISPLAY_DEPTH) {
                  const replyWithDepth = { ...reply, threadDepth: depth }
                  processedMessages.push(replyWithDepth)
                  seenMessages.add(reply.id)

                  // Process nested replies
                  if (messageMap.has(reply.id)) {
                    processThread(reply.id)
                  }
                }
              })
            }

            // Process the main thread
            processThread(currentParentMessage.id)
            
            // Update thread message IDs ref
            threadMessageIdsRef.current.add(messageData.id)
            
            return processedMessages
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${currentParentMessage.channel_id}`
        },
        (payload) => {
          if (!threadMessageIdsRef.current.has(payload.new.id)) return

          setThreadMessages(prev => prev.map(msg => 
            msg.id === payload.new.id 
              ? { 
                  ...msg, 
                  content: payload.new.content,
                  updated_at: payload.new.updated_at,
                  reply_count: payload.new.reply_count
                }
              : msg
          ))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${currentParentMessage.channel_id}`
        },
        (payload) => {
          console.log('Delete event received:', {
            deletedId: payload.old.id,
            isInThread: threadMessageIdsRef.current.has(payload.old.id),
            threadMessages: threadMessages.map(m => ({ id: m.id, replyTo: m.reply_to }))
          })

          // Check if this message is part of our thread
          if (!threadMessageIdsRef.current.has(payload.old.id)) return

          // Remove the deleted message and any messages that reply to it
          setThreadMessages(prev => {
            // First, find all messages that need to be removed (the deleted message and its replies)
            const messagesToRemove = new Set<string>()
            
            // Helper function to recursively find replies
            const findReplies = (messageId: string) => {
              messagesToRemove.add(messageId)
              prev.forEach(msg => {
                if (msg.reply_to === messageId) {
                  findReplies(msg.id)
                }
              })
            }

            // Start with the deleted message
            findReplies(payload.old.id)

            console.log('Messages to remove:', Array.from(messagesToRemove))

            // Filter out all removed messages
            const filtered = prev.filter(msg => !messagesToRemove.has(msg.id))

            // Update our thread message IDs ref
            messagesToRemove.forEach(id => {
              threadMessageIdsRef.current.delete(id)
            })

            return filtered
          })
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up thread subscription')
      supabase.removeChannel(channel)
    }
  }, [currentParentMessage.id, currentParentMessage.channel_id])

  const loadMessages = async () => {
    setIsLoading(true)
    const messages = await loadThreadMessages(currentParentMessage.id)
    
    // Update the thread message IDs set
    threadMessageIdsRef.current = new Set([
      currentParentMessage.id,
      ...messages.map(msg => msg.id)
    ])
    
    console.log('Thread message IDs updated:', {
      ids: Array.from(threadMessageIdsRef.current),
      messages: messages.map(m => ({ id: m.id, replyTo: m.reply_to }))
    })
    
    // Create a map of replies for each message
    const messageMap = new Map<string, ThreadMessage[]>()
    messages.forEach(message => {
      if (message.id === currentParentMessage.id) return // Skip parent message as it's rendered separately
      
      const parentId = message.reply_to || currentParentMessage.id
      const existing = messageMap.get(parentId) || []
      messageMap.set(parentId, [...existing, { ...message, threadDepth: 0 }])
    })

    // Sort each group of replies by timestamp
    messageMap.forEach((replies) => {
      replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    })

    // Process messages with proper depth
    const processedMessages: ThreadMessage[] = []
    const seenMessages = new Set<string>()

    // Helper function to get message depth
    const getMessageDepth = (messageId: string): number => {
      let depth = 0
      let currentId = messageId
      let parentId = messages.find(m => m.id === currentId)?.reply_to

      while (parentId && parentId !== currentParentMessage.id) {
        depth++
        currentId = parentId
        parentId = messages.find(m => m.id === currentId)?.reply_to
      }
      return depth
    }

    // Process the thread
    const processThread = (parentId: string) => {
      const replies = messageMap.get(parentId) || []
      
      replies.forEach(reply => {
        if (seenMessages.has(reply.id)) return

        const depth = getMessageDepth(reply.id)
        if (depth < MAX_DISPLAY_DEPTH) {
          const replyWithDepth = { ...reply, threadDepth: depth }
          processedMessages.push(replyWithDepth)
          seenMessages.add(reply.id)

          // Process nested replies
          if (messageMap.has(reply.id)) {
            processThread(reply.id)
          }
        }
      })
    }

    // Process the main thread
    processThread(currentParentMessage.id)
    setThreadMessages(processedMessages)
    setIsLoading(false)
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newReply.trim()) return

    const replyToId = replyingTo?.id || currentParentMessage.id
    const success = await sendMessage(newReply.trim(), replyToId)
    if (success) {
      setNewReply('')
      setReplyingTo(null)
      // Don't reload messages, let realtime handle it
    }
  }

  const handleStartEdit = (message: Message) => {
    setEditingMessage(message.id)
    setEditContent(message.content)
  }

  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return

    const success = await updateMessage(messageId, editContent.trim())
    if (success) {
      setEditingMessage(null)
      setEditContent('')
    }
  }

  const handleCancelEdit = () => {
    setEditingMessage(null)
    setEditContent('')
  }

  const renderThreadPath = () => {
    if (threadStack.length <= 1) return null;

    return (
      <div className="flex items-center gap-1 mb-2 text-sm text-muted-foreground">
        {threadStack.map((message, index) => (
          <div key={message.id} className="flex items-center">
            {index > 0 && <ArrowLeft className="h-3 w-3 mx-1" />}
            <span className="hover:text-foreground cursor-pointer" onClick={() => navigateToStackIndex(index)}>
              {message.user?.username}'s thread
            </span>
          </div>
        ))}
      </div>
    );
  };

  const navigateToStackIndex = (index: number) => {
    // Navigate to a specific point in the thread stack
    setThreadStack(prev => prev.slice(0, index + 1))
    setReplyingTo(null)
    setEditingMessage(null)
    setEditContent('')
  }

  const navigateToThread = (message: Message) => {
    // Check if this message is already in our stack to prevent loops
    const existingIndex = threadStack.findIndex(m => m.id === message.id)
    if (existingIndex !== -1) {
      // If found, navigate back to that point in the stack
      navigateToStackIndex(existingIndex)
      return
    }

    // Add new message to stack
    setThreadStack(prev => [...prev, message])
    setReplyingTo(null)
    setEditingMessage(null)
    setEditContent('')
  }

  const navigateBack = () => {
    if (threadStack.length <= 1) return
    setThreadStack(prev => prev.slice(0, -1))
    setReplyingTo(null)
    setEditingMessage(null)
    setEditContent('')
  }

  const renderMessage = (message: ThreadMessage) => {
    const hasReplies = message.reply_count > 0
    const shouldShowInNewThread = message.threadDepth >= MAX_DISPLAY_DEPTH - 1

    return (
      <div 
        key={message.id} 
        className={`group hover:bg-accent/5 rounded p-2 ${
          message.threadDepth > 0 ? 'ml-8 border-l-2 border-accent/20' : ''
        }`}
      >
        <div className="flex items-start space-x-2">
          <div className={`${message.id === currentParentMessage.id ? 'w-10 h-10' : 'w-8 h-8'} rounded-full bg-primary/10 flex items-center justify-center`}>
            {message.user?.username?.[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline space-x-2">
              <span className={`font-semibold ${message.id === currentParentMessage.id ? '' : 'text-sm'}`}>{message.user?.username}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
              </span>
            </div>
            {editingMessage === message.id ? (
              <div className="flex items-center space-x-2 mt-1">
                <Input
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="flex-1"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSaveEdit(message.id)
                    } else if (e.key === 'Escape') {
                      handleCancelEdit()
                    }
                  }}
                />
                <div className="flex items-center space-x-2">
                  <Button size="sm" onClick={() => handleSaveEdit(message.id)}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <p className={`mt-1 ${message.id === currentParentMessage.id ? 'text-sm' : 'text-sm'} leading-relaxed`}>
                  {message.content}
                </p>
                <div className="flex items-center gap-4 mt-1">
                  <MessageReactions messageId={message.id} />
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-accent flex items-center"
                      onClick={() => shouldShowInNewThread ? navigateToThread(message) : setReplyingTo(message)}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      <span className="ml-1.5 text-xs">{shouldShowInNewThread ? 'Reply in thread' : 'Reply'}</span>
                    </Button>
                    {hasReplies && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-accent flex items-center"
                        onClick={() => navigateToThread(message)}
                      >
                        <span className="text-xs">Show thread</span>
                      </Button>
                    )}
                    {message.user_id === profile?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStartEdit(message)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteMessage(message.id)}>
                            <Trash className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full border-l">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            {threadStack.length > 1 && (
              <Button variant="ghost" size="sm" onClick={navigateBack} className="h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h3 className="text-lg font-semibold">Thread</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {renderThreadPath()}
        {renderMessage({ ...currentParentMessage, threadDepth: 0 })}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <span className="text-sm text-muted-foreground">Loading replies...</span>
            </div>
          ) : threadMessages.length === 0 ? (
            <div className="flex justify-center p-4">
              <span className="text-sm text-muted-foreground">No replies yet</span>
            </div>
          ) : (
            <div className="space-y-4">
              {threadMessages.map((message) => renderMessage(message))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSendReply} className="border-t p-4">
        <div className="space-y-4">
          {replyingTo && replyingTo.id !== currentParentMessage.id && (
            <div className="text-xs text-muted-foreground flex items-center">
              <span>Replying to {replyingTo.user?.username}'s message</span>
              <Button variant="ghost" size="sm" className="h-4 px-1 ml-2" onClick={() => setReplyingTo(null)}>
                Cancel
              </Button>
            </div>
          )}
          <Input
            value={newReply}
            onChange={(e) => setNewReply(e.target.value)}
            placeholder="Reply to thread..."
            className="flex-1"
          />
          <div className="flex items-center justify-end">
            <Button type="submit" disabled={!newReply.trim()}>
              Reply
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
} 