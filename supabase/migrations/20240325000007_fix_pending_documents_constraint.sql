-- First, clean up duplicates by keeping only the most recent pending embedding for each file
WITH duplicates AS (
    SELECT file_id, 
           id,
           ROW_NUMBER() OVER (PARTITION BY file_id ORDER BY updated_at DESC) as rn
    FROM pending_document_embeddings
)
DELETE FROM pending_document_embeddings
WHERE id IN (
    SELECT id 
    FROM duplicates 
    WHERE rn > 1
);

-- Add unique constraint on file_id in pending_document_embeddings
ALTER TABLE pending_document_embeddings
ADD CONSTRAINT pending_document_embeddings_file_id_key UNIQUE (file_id); 