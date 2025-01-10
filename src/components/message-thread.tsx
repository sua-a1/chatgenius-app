import { useState } from 'react'
import { useMessageThread } from '@/hooks/use-message-thread'
import { Message } from '@/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface MessageThreadProps {
  parentMessage: Message
  onClose: () => void
}

export function MessageThread({ parentMessage, onClose }: MessageThreadProps) {
  const [replyContent, setReplyContent] = useState('')
  const { messages, isLoading, replyToMessage } = useMessageThread(parentMessage.id)

  const handleSendReply = async () => {
    if (!replyContent.trim()) return

    const messageId = await replyToMessage(replyContent)
    if (messageId) {
      setReplyContent('')
    }
  }

  return (
    <div className="flex flex-col h-full border-l">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold">Thread</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Parent Message */}
          <div className="flex items-start space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={parentMessage.user?.avatar_url} />
              <AvatarFallback>{parentMessage.user?.username?.[0] || '?'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium">{parentMessage.user?.username}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(parentMessage.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm">{parentMessage.content}</p>
            </div>
          </div>

          {/* Replies */}
          {isLoading ? (
            <div className="text-center text-muted-foreground">Loading replies...</div>
          ) : messages.length <= 1 ? (
            <div className="text-center text-muted-foreground">No replies yet</div>
          ) : (
            <div className="space-y-4 mt-4 pl-4 border-l-2">
              {messages.filter(m => m.id !== parentMessage.id).map((message) => (
                <div key={message.id} className="flex items-start space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={message.user?.avatar_url} />
                    <AvatarFallback>{message.user?.username?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{message.user?.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="space-y-2">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Reply to thread..."
            className="min-h-[100px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendReply()
              }
            }}
          />
          <div className="flex justify-end">
            <Button onClick={handleSendReply}>Reply</Button>
          </div>
        </div>
      </div>
    </div>
  )
} 