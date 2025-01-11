import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileUpload } from '@/components/ui/file-upload'
import { FilePreview } from '@/components/ui/file-preview'
import { Paperclip, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageComposerProps {
  onSendMessage: (content: string, attachments?: string[]) => Promise<boolean>
  placeholder?: string
  className?: string
  workspaceId: string
  channelId?: string
  directMessageId?: string
  userId: string
  disabled?: boolean
  editingContent?: string | null
  onEditChange?: (content: string) => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
}

export function MessageComposer({
  onSendMessage,
  placeholder = 'Type a message...',
  className,
  workspaceId,
  channelId,
  directMessageId,
  userId,
  disabled = false,
  editingContent = null,
  onEditChange,
  onSaveEdit,
  onCancelEdit
}: MessageComposerProps) {
  const [message, setMessage] = useState(editingContent || '')
  const [isAttaching, setIsAttaching] = useState(false)
  const [attachments, setAttachments] = useState<Array<{ url: string; filename: string }>>([])
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (editingContent !== null) {
      setMessage(editingContent)
    }
  }, [editingContent])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() && attachments.length === 0) return

    if (editingContent !== null && onSaveEdit) {
      onSaveEdit()
      return
    }

    const success = await onSendMessage(
      message.trim(),
      attachments.map(a => a.url)
    )

    if (success) {
      setMessage('')
      setAttachments([])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newContent = e.target.value
    setMessage(newContent)
    if (editingContent !== null && onEditChange) {
      onEditChange(newContent)
    }
  }

  const handleFileUpload = (url: string, filename: string) => {
    setAttachments(prev => [...prev, { url, filename }])
    setIsAttaching(false)
  }

  const removeAttachment = (url: string) => {
    setAttachments(prev => prev.filter(a => a.url !== url))
  }

  return (
    <div className={cn('border-t p-4', className)}>
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-4">
          <FilePreview
            attachments={attachments}
            onRemove={removeAttachment}
            showRemoveButton={true}
          />
        </div>
      )}

      {/* File Upload Area */}
      {isAttaching && (
        <div className="mb-4">
          <FileUpload
            workspaceId={workspaceId}
            onFilesSelected={(urls) => {
              urls.forEach(url => handleFileUpload(url, url.split('/').pop() || 'unknown'))
            }}
            disabled={disabled}
          />
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAttaching(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <form ref={formRef} onSubmit={handleSubmit} className="flex items-end space-x-2">
        <div className="flex-1 space-y-2">
          <Input
            value={message}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                formRef.current?.requestSubmit()
              } else if (e.key === 'Escape' && editingContent !== null && onCancelEdit) {
                e.preventDefault()
                onCancelEdit()
              }
            }}
          />
        </div>
        <div className="flex space-x-2">
          {!editingContent && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsAttaching(true)}
              disabled={disabled || isAttaching}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="submit"
            size="icon"
            disabled={disabled || (!message.trim() && attachments.length === 0)}
          >
            <Send className="h-4 w-4" />
          </Button>
          {editingContent !== null && onCancelEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onCancelEdit}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
} 