import { createClient } from '@/lib/supabase/client'
import { v4 as uuidv4 } from 'uuid'

const AVATAR_BUCKET = 'avatars'
const MESSAGE_ATTACHMENTS_BUCKET = 'message-attachments'
const WORKSPACE_FILES_BUCKET = 'workspace-files'

export type FileUploadType = 'avatar' | 'message-attachment' | 'workspace-file'

interface UploadOptions {
  workspaceId?: string
  channelId?: string
  directMessageId?: string
  userId: string
}

export interface FileMetadata {
  file_url: string
  filename: string
  file_type: string
  file_size: number
  metadata: {
    content_type: string
    last_modified: number
    extension: string | undefined
    original_name: string
    storage_path: string
    bucket: string
    created_at: string
  }
}

export async function uploadFile(
  file: File,
  type: FileUploadType,
  options: UploadOptions
): Promise<string | { url: string, metadata: FileMetadata }> {
  const supabase = createClient()
  const bucket = getBucketForType(type)
  
  // Create a unique file path
  const fileExt = file.name.split('.').pop()
  const fileName = `${uuidv4()}.${fileExt}`
  const filePath = getFilePath(type, fileName, options)

  // Upload the file
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    throw new Error(`Error uploading file: ${error.message}`)
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath)

  // For message attachments, return metadata without storing it
  if (type === 'message-attachment' && options.channelId) {
    const metadata: FileMetadata = {
      file_url: publicUrl,
      filename: file.name,
      file_type: file.type || getFileTypeFromName(file.name),
      file_size: file.size,
      metadata: {
        content_type: file.type,
        last_modified: file.lastModified,
        extension: file.name.split('.').pop()?.toLowerCase(),
        original_name: file.name,
        storage_path: filePath,
        bucket: bucket,
        created_at: new Date().toISOString()
      }
    }

    return { url: publicUrl, metadata }
  }

  return publicUrl
}

export async function deleteFile(
  fileUrl: string,
  type: FileUploadType
): Promise<void> {
  const supabase = createClient()
  const bucket = getBucketForType(type)
  
  // Extract the file path from the URL
  const urlObj = new URL(fileUrl)
  const filePath = urlObj.pathname.split(`/${bucket}/`)[1]

  if (!filePath) {
    throw new Error('Invalid file URL')
  }

  const { error } = await supabase.storage
    .from(bucket)
    .remove([filePath])

  if (error) {
    throw new Error(`Error deleting file: ${error.message}`)
  }

  // Delete metadata only for message attachments
  if (type === 'message-attachment') {
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .match({ file_url: fileUrl })

    if (dbError) {
      throw new Error(`Error deleting file metadata: ${dbError.message}`)
    }
  }
}

function getBucketForType(type: FileUploadType): string {
  switch (type) {
    case 'avatar':
      return AVATAR_BUCKET
    case 'message-attachment':
      return MESSAGE_ATTACHMENTS_BUCKET
    case 'workspace-file':
      return WORKSPACE_FILES_BUCKET
    default:
      throw new Error('Invalid file type')
  }
}

function getFilePath(
  type: FileUploadType,
  fileName: string,
  options: UploadOptions
): string {
  switch (type) {
    case 'avatar':
      return `${options.userId}/${fileName}`
    case 'message-attachment':
      if (options.channelId) {
        return `${options.workspaceId}/channels/${options.channelId}/${fileName}`
      } else if (options.directMessageId) {
        return `${options.workspaceId}/dms/${options.directMessageId}/${fileName}`
      } else {
        throw new Error('Either channelId or directMessageId must be provided for message attachments')
      }
    case 'workspace-file':
      return `${options.workspaceId}/${fileName}`
    default:
      throw new Error('Invalid file type')
  }
}

// Helper function to determine file type from filename if MIME type is not available
function getFileTypeFromName(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    // Other
    'json': 'application/json',
    'xml': 'application/xml'
  }
  
  return mimeTypes[ext] || 'application/octet-stream'
} 