import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useChannelMessages } from '@/hooks/use-channel-messages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { Edit, MoreVertical, Trash, ArrowUpRight } from 'lucide-react'
import { MessageReactions } from './message-reactions'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import ThreadView from './thread-view'
import { Message } from '@/types'
import { UserProfileDisplay } from './user-profile-display'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUserStatus } from '@/contexts/user-status-context'

interface ChannelMessageAreaProps {
  workspace: {
    id: string
  } | null
  selectedChannelId: string | null
}

export default function ChannelMessageArea({ workspace, selectedChannelId }: ChannelMessageAreaProps) {
  const { profile } = useAuth()
  const { messages, selectedChannel, isLoading, sendMessage, deleteMessage, updateMessage, loadThreadMessages } = useChannelMessages(workspace?.id, selectedChannelId)
  const [newMessage, setNewMessage] = useState('')
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [selectedThread, setSelectedThread] = useState<Message | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { userStatuses } = useUserStatus()

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedChannelId || !workspace) return

    const success = await sendMessage(newMessage.trim())
    if (success) {
      setNewMessage('')
    }
  }

  const handleStartEdit = (messageId: string, content: string) => {
    setEditingMessage(messageId)
    setEditContent(content)
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

  if (!workspace || !selectedChannelId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a channel to start chatting
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <span>Loading messages...</span>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {messages.map((message: Message, index: number) => {
                const previousMessage = index > 0 ? messages[index - 1] : null
                const isFirstMessageFromUser = !previousMessage || previousMessage.user_id !== message.user_id
                const timeDiff = previousMessage 
                  ? new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime()
                  : 0
                const shouldShowHeader = isFirstMessageFromUser || timeDiff > 300000 // 5 minutes

                return (
                  <div key={message.id} className="group hover:bg-accent/5 -mx-4 px-4 py-1 rounded">
                    {shouldShowHeader && message.user && (
                      <div className="flex items-center space-x-2 mb-1">
                        <UserProfileDisplay
                          user={{
                            id: message.user.id,
                            username: message.user.username || 'Unknown User',
                            avatar_url: message.user.avatar_url,
                            created_at: message.created_at
                          }}
                          onStartDM={() => console.log('Start DM with user:', message.user_id)}
                        >
                          <div className="flex items-center space-x-2">
                            <Avatar 
                              className="h-8 w-8 mt-[2px]"
                              status={userStatuses.get(message.user?.id || '')}
                            >
                              <AvatarImage src={message.user?.avatar_url || undefined} />
                              <AvatarFallback>
                                {message.user?.username?.[0] || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-baseline space-x-2">
                              <span className="font-semibold">{message.user.username || 'Unknown User'}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </UserProfileDisplay>
                      </div>
                    )}
                    <div className="flex items-start pl-12">
                      <div className="flex-1">
                        {editingMessage === message.id ? (
                          <div className="flex items-center space-x-2">
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
                          <div className="flex flex-col gap-1">
                            {message.reply_to && (
                              <Button
                                variant="link"
                                size="sm"
                                className="self-start text-xs text-muted-foreground hover:text-foreground -ml-2 h-4 px-2 mb-0.5"
                                onClick={() => {
                                  const parentMessage = messages.find(m => m.id === message.reply_to)
                                  if (parentMessage) {
                                    setSelectedThread(parentMessage)
                                  }
                                }}
                              >
                                <ArrowUpRight className="h-3 w-3 mr-1" />
                                View thread
                              </Button>
                            )}
                            <div className="flex items-start space-x-2">
                              <p className="flex-1 text-sm leading-relaxed">
                                {message.content}
                              </p>
                              {message.user_id === profile?.id && (
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                            </div>
                            <div className="flex items-center gap-4">
                              <MessageReactions messageId={message.id} />
                              <div className={message.reply_count > 0 ? '' : 'opacity-0 group-hover:opacity-100'}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-accent flex items-center"
                                  onClick={() => setSelectedThread(message)}
                                >
                                  <ArrowUpRight className="h-4 w-4" />
                                  {message.reply_count > 0 ? (
                                    <span className="ml-1.5 text-xs">
                                      {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
                                    </span>
                                  ) : (
                                    <span className="ml-1.5 text-xs">
                                      Reply
                                    </span>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <form onSubmit={handleSendMessage} className="border-t p-4">
          <div className="flex space-x-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={`Message #${selectedChannel?.name}`}
              className="flex-1"
            />
            <Button type="submit" disabled={!newMessage.trim()}>
              Send
            </Button>
          </div>
        </form>
      </div>

      {selectedThread && (
        <div className="w-96">
          <ThreadView
            parentMessage={selectedThread}
            onClose={() => setSelectedThread(null)}
            sendMessage={sendMessage}
            loadThreadMessages={loadThreadMessages}
            updateMessage={updateMessage}
            deleteMessage={deleteMessage}
          />
        </div>
      )}
    </div>
  )
} 