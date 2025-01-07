import { useDirectMessages } from '@/hooks/use-direct-messages'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DirectMessagesProps {
  workspaceId: string
  selectedUserId: string | null
  onSelectUser: (userId: string) => void
}

export function DirectMessages({ workspaceId, selectedUserId, onSelectUser }: DirectMessagesProps) {
  const [newMessage, setNewMessage] = useState('')
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null)
  const { messages, recentChats, isLoading, sendMessage, deleteMessage } = useDirectMessages(workspaceId, selectedUserId)
  const { profile } = useAuth()

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const success = await sendMessage(newMessage.trim())
    if (success) {
      setNewMessage('')
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    await deleteMessage(messageId)
    setMessageToDelete(null)
  }

  if (!workspaceId) return null

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Recent Chats */}
        <div className="p-4 border-b">
          <h2 className="font-semibold mb-2">Direct Messages</h2>
          <div className="space-y-2">
            {recentChats.map((chat) => (
              <button
                key={chat.user_id}
                onClick={() => onSelectUser(chat.user_id)}
                className={`flex items-center space-x-2 w-full p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  selectedUserId === chat.user_id ? 'bg-gray-100 dark:bg-gray-800' : ''
                }`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={chat.avatar_url || undefined} />
                  <AvatarFallback>{chat.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{chat.username}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        {selectedUserId ? (
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-sm text-gray-500">Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-sm text-gray-500">No messages yet. Start a conversation!</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`group flex items-start space-x-2 ${
                        message.sender_id === selectedUserId ? 'flex-row' : 'flex-row-reverse space-x-reverse'
                      }`}
                    >
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarImage src={message.sender.avatar_url || undefined} />
                        <AvatarFallback>{message.sender.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className={`flex flex-col ${message.sender_id === selectedUserId ? 'items-start' : 'items-end'}`}>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{message.sender.username}</span>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex items-start space-x-2">
                          <div
                            className={`mt-1 px-3 py-2 rounded-lg ${
                              message.sender_id === selectedUserId
                                ? 'bg-gray-100 dark:bg-gray-800'
                                : 'bg-blue-500 text-white'
                            }`}
                          >
                            {message.content}
                          </div>
                          {message.sender_id === profile?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setMessageToDelete(message.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t">
              <div className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-gray-500">Select a user to start messaging</span>
          </div>
        )}
      </div>

      <AlertDialog open={!!messageToDelete} onOpenChange={(open: boolean) => !open && setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => messageToDelete && handleDeleteMessage(messageToDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 