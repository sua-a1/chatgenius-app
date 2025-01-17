export const CHUNK_SIZE = 1000; // Characters per chunk
export const CHUNK_OVERLAP = 200; // Characters of overlap between chunks

export const EMBEDDING_MODEL = 'text-embedding-ada-002';
export const MAX_RETRIES = 3;

export const SUPPORTED_FILE_TYPES = {
  TEXT: 'text/plain',
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC: 'application/msword'
} as const; 