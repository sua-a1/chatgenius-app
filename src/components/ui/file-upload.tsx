'use client'

import { useState, useCallback } from 'react'
import { Button } from './button'
import { Paperclip } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Progress } from './progress'
import pako from 'pako'

interface FileUploadProps {
  workspaceId: string
  onFilesSelected: (fileUrls: string[]) => void
  onError?: (error: Error) => void
  disabled?: boolean
}

interface UploadingFile {
  file: File
  progress: number
}

export function FileUpload({ workspaceId, onFilesSelected, onError, disabled }: FileUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const compressFile = async (file: File): Promise<Blob> => {
    // Only compress text-based files and PDFs
    if (!file.type.match(/(text|pdf|doc|docx)/)) {
      return file
    }

    try {
      const buffer = await file.arrayBuffer()
      const compressed = pako.deflate(new Uint8Array(buffer))
      return new Blob([compressed], { type: file.type })
    } catch (error) {
      console.warn('Compression failed, using original file:', error)
      return file
    }
  }

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${workspaceId}/${Math.random().toString(36).slice(2)}.${fileExt}`

    try {
      // Compress file if possible
      const compressedFile = await compressFile(file)

      // Upload file with progress tracking
      const { data, error } = await supabase.storage
        .from('chat_attachments')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        })

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat_attachments')
        .getPublicUrl(data.path)

      return publicUrl
    } catch (error) {
      console.error('Error uploading file:', error)
      return null
    }
  }, [workspaceId])

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return []

    setIsUploading(true)
    setUploadingFiles(files.map(file => ({ file, progress: 0 })))

    try {
      // Upload all files concurrently
      const uploadPromises = files.map(file => {
        // Simulate progress since we can't get real progress from Supabase
        const interval = setInterval(() => {
          setUploadingFiles(prev => 
            prev.map(f => 
              f.file === file
                ? { ...f, progress: Math.min(f.progress + 10, 90) }
                : f
            )
          )
        }, 500)

        return uploadFile(file).then(url => {
          clearInterval(interval)
          setUploadingFiles(prev => 
            prev.map(f => 
              f.file === file
                ? { ...f, progress: 100 }
                : f
            )
          )
          return url
        })
      })

      const urls = await Promise.all(uploadPromises)
      const validUrls = urls.filter((url): url is string => url !== null)

      if (validUrls.length > 0) {
        onFilesSelected(validUrls)
      }

      if (validUrls.length < files.length) {
        toast({
          variant: 'destructive',
          title: 'Some files failed to upload',
          description: 'Please try uploading the failed files again.'
        })
      }

      return validUrls
    } catch (error) {
      console.error('Error uploading files:', error)
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'Failed to upload one or more files. Please try again.'
      })
      if (onError && error instanceof Error) {
        onError(error)
      }
      return []
    } finally {
      setIsUploading(false)
      setUploadingFiles([])
    }
  }, [workspaceId, onFilesSelected, onError, toast, uploadFile])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    // Filter out files larger than 50MB
    const validFiles = files.filter(file => file.size <= 50 * 1024 * 1024)
    const invalidFiles = files.filter(file => file.size > 50 * 1024 * 1024)

    if (invalidFiles.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Files too large',
        description: 'Some files were not added because they exceed the 50MB limit.'
      })
    }

    if (validFiles.length > 0) {
      await uploadFiles(validFiles)
    }
    // Reset input value so the same file can be selected again
    e.target.value = ''
  }, [toast, uploadFiles])

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled || isUploading}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          id="file-upload"
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
      </div>
      
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((file, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="max-w-[200px] truncate">{file.file.name}</span>
                <span>{formatFileSize(file.file.size)}</span>
              </div>
              <Progress value={file.progress} className="h-1" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 