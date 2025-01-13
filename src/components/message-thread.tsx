import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { FilePreview } from '@/components/ui/file-preview'
import { FileUpload } from '@/components/ui/file-upload'
import { X, Paperclip } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useMessageThread } from '@/hooks/use-message-thread'
import { Message } from '@/types'
import { MessageComposer } from '@/components/message-composer'
import { useAuth } from '@/contexts/auth-context'

interface MessageThreadProps {
  parentMessage: Message & { workspace_id: string }
  onClose: () => void
}

export function MessageThread({ parentMessage, onClose }: MessageThreadProps) {
  const { profile } = useAuth()
  const { messages, isLoading, replyToMessage } = useMessageThread(parentMessage.id)

  const handleSendMessage = async (content: string, attachments?: string[]) => {
    console.log('[DEBUG] MessageThread handleSendMessage called with:', { content, attachments })
    const messageId = await replyToMessage(content, attachments?.map(url => ({ url, filename: url.split('/').pop() || 'file' })))
    console.log('[DEBUG] Reply sent, messageId:', messageId)
    return !!messageId
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
              {parentMessage.attachments && parentMessage.attachments.length > 0 && (
                <FilePreview attachments={parentMessage.attachments} />
              )}
            </div>
          </div>

          {/* Thread Messages */}
          {messages.map(message => (
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
                {message.attachments && message.attachments.length > 0 && (
                  <FilePreview attachments={message.attachments} />
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <MessageComposer
          onSendMessage={handleSendMessage}
          workspaceId={parentMessage.workspace_id}
          userId={profile?.id || ''}
          placeholder="Reply to thread..."
          disabled={!profile?.id}
        />
      </div>
    </div>
  )
} 