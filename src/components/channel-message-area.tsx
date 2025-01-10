import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useChannelMessages } from '@/hooks/use-channel-messages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { Edit, MoreVertical, Trash } from 'lucide-react'
import { MessageReactions } from './message-reactions'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface MessageUser {
  id: string
  username: string
  avatar_url: string | null
}

interface Message {
  id: string
  content: string
  created_at: string
  user_id: string
  channel_id: string
  sender: MessageUser
  reactions: MessageReaction[]
}

interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
  username: string
  avatar_url: string | null
}

interface ChannelMessageAreaProps {
  workspace: {
    id: string
  } | null
  selectedChannelId: string | null
}

export default function ChannelMessageArea({ workspace, selectedChannelId }: ChannelMessageAreaProps) {
  const { profile } = useAuth()
  const { messages, selectedChannel, isLoading, sendMessage, deleteMessage, updateMessage } = useChannelMessages(workspace?.id, selectedChannelId)
  const [newMessage, setNewMessage] = useState('')
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-2">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            #
          </div>
          <h2 className="font-semibold">{selectedChannel?.name}</h2>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
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
            {messages.map((message: Message, index: number) => {
              const previousMessage = index > 0 ? messages[index - 1] : null
              const isFirstMessageFromUser = !previousMessage || previousMessage.user_id !== message.user_id
              const timeDiff = previousMessage 
                ? new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime()
                : 0
              const shouldShowHeader = isFirstMessageFromUser || timeDiff > 300000 // 5 minutes

              return (
                <div key={message.id} className="group hover:bg-accent/5 -mx-4 px-4 py-1 rounded">
                  {shouldShowHeader && (
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {message.sender.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-baseline space-x-2">
                          <span className="font-semibold">{message.sender.username}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
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
                          <div className="flex items-start group/message">
                            <p className="flex-1 text-sm leading-relaxed">
                              {message.content}
                            </p>
                            {message.user_id === profile?.id && (
                              <div className="opacity-0 group-hover/message:opacity-100 transition-opacity ml-2">
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
                          <MessageReactions messageId={message.id} />
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
  )
} 