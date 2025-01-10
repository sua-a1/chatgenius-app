'use client'

import { FileIcon, ImageIcon, VideoIcon, Music, FileTextIcon, X } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface FileAttachment {
  url: string
  filename: string
}

interface FilePreviewProps {
  attachments: FileAttachment[]
  onRemove?: (url: string) => void
  showRemoveButton?: boolean
}

export function FilePreview({ attachments, onRemove, showRemoveButton = false }: FilePreviewProps) {
  const getFileType = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (!ext) return 'other'

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
    if (['mp4', 'webm', 'ogg'].includes(ext)) return 'video'
    if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio'
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return 'document'
    return 'other'
  }

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />
      case 'video':
        return <VideoIcon className="h-4 w-4" />
      case 'audio':
        return <Music className="h-4 w-4" />
      case 'document':
        return <FileTextIcon className="h-4 w-4" />
      default:
        return <FileIcon className="h-4 w-4" />
    }
  }

  if (!attachments || attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-4 mt-2">
      {attachments.map((attachment, index) => {
        const fileType = getFileType(attachment.filename)
        const isImage = fileType === 'image'

        return (
          <div key={index} className="relative group">
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 max-w-full"
            >
              {isImage ? (
                <div className="relative h-32 w-32 rounded-md overflow-hidden border">
                  <Image
                    src={attachment.url}
                    alt={attachment.filename}
                    fill
                    sizes="(max-width: 768px) 100vw, 128px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-accent/50 text-accent-foreground rounded px-3 py-2">
                  {getFileIcon(fileType)}
                  <span className="max-w-[200px] truncate text-sm">
                    {attachment.filename}
                  </span>
                </div>
              )}
            </a>
            {showRemoveButton && onRemove && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-sm"
                onClick={() => onRemove(attachment.url)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
} 