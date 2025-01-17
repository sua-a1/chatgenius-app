-- Queue all existing files that don't have embeddings yet
WITH files_to_queue AS (
  SELECT f.id as file_id
  FROM files f
  LEFT JOIN document_embeddings de ON f.id = de.file_id AND de.is_latest = true
  WHERE de.id IS NULL  -- Only files without embeddings
  AND is_supported_document_type(f.file_type)  -- Only supported file types
)
INSERT INTO pending_document_embeddings (file_id, status, attempts)
SELECT file_id, 'pending', 0
FROM files_to_queue
ON CONFLICT (file_id) DO UPDATE
SET status = 'pending',
    attempts = 0,
    error_message = null,
    last_attempt = null,
    updated_at = now();

-- Show how many documents were queued
SELECT count(*) as queued_documents 
FROM pending_document_embeddings 
WHERE status = 'pending'; 