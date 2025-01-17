export interface ProcessDocumentPayload {
  fileId: string;
  workspaceId: string;
  channelId?: string;
  userId?: string;
}

export interface ProcessingResult {
  success: boolean;
  file_id: string;
  error?: string;
}

export interface FileMetadata {
  filename: string;
  file_type: string;
  file_size: number;
  file_url: string;
  updated_at: string;
}

export interface DocumentChunk {
  text: string;
  metadata: {
    chunk_size: number;
    chunk_overlap: number;
    chunk_index: number;
    total_chunks: number;
    filename: string;
    file_type: string;
  };
} 