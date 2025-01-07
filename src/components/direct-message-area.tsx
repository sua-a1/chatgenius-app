'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { Workspace } from '@/types'
import { useDirectMessages } from '@/hooks/use-direct-messages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { Trash } from 'lucide-react'

interface DirectMessageAreaProps {
  workspace: Workspace | null
  selectedUserId?: string | null
}

export default function DirectMessageArea({ workspace, selectedUserId: initialSelectedUserId }: DirectMessageAreaProps) {
  const { profile } = useAuth()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialSelectedUserId || null)
  const {
    messages,
    recentChats,
    isLoading,
    sendMessage,
    deleteMessage,
  } = useDirectMessages(workspace?.id, selectedUserId)
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (initialSelectedUserId) {
      setSelectedUserId(initialSelectedUserId)
    }
  }, [initialSelectedUserId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const success = await sendMessage(newMessage.trim())
    if (success) {
      setNewMessage('')
    }
  }

  const selectedUser = recentChats.find(chat => chat.user_id === selectedUserId)

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Please select a workspace to start chatting
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {selectedUserId ? (
        <>
          <div className="border-b px-4 py-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                {selectedUser?.username[0].toUpperCase()}
              </div>
              <h2 className="font-semibold">{selectedUser?.username}</h2>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                This is the beginning of your conversation with {selectedUser?.username}
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isCurrentUser = message.sender_id === profile?.id
                  const previousMessage = index > 0 ? messages[index - 1] : null
                  const isFirstMessageFromUser = !previousMessage || previousMessage.sender_id !== message.sender_id
                  const timeDiff = previousMessage 
                    ? new Date(message.created_at).getTime() - new Date(previousMessage.created_at).getTime()
                    : 0
                  const shouldShowHeader = isFirstMessageFromUser || timeDiff > 300000 // 5 minutes

                  return (
                    <div key={message.id} className="group hover:bg-accent/5 -mx-4 px-4 py-1 rounded">
                      {shouldShowHeader && (
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
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
                      <div className="flex items-start pl-10">
                        <div className="flex-1">
                          <div className="flex items-start group/message">
                            <p className="flex-1 text-sm leading-relaxed">
                              {message.content}
                            </p>
                            {isCurrentUser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMessage(message.id)}
                                className="opacity-0 group-hover/message:opacity-100 transition-opacity h-6 w-6 p-0"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
                placeholder={`Message ${selectedUser?.username}`}
            className="flex-1"
          />
              <Button type="submit" disabled={!newMessage.trim()}>
                Send
              </Button>
            </div>
          </form>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Select a user to start chatting
        </div>
      )}
    </div>
  )
}

