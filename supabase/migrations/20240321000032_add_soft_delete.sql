-- Add soft delete column to message_embeddings
ALTER TABLE message_embeddings
ADD COLUMN is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN deleted_at timestamptz;

-- Update the handle_message_delete function to use soft delete
CREATE OR REPLACE FUNCTION handle_message_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Soft delete all embeddings for this message
    UPDATE message_embeddings
    SET is_deleted = true,
        deleted_at = now(),
        is_latest = false
    WHERE message_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop all versions of search_messages function
DROP FUNCTION IF EXISTS search_messages(vector, uuid);
DROP FUNCTION IF EXISTS search_messages(vector, uuid, integer);
DROP FUNCTION IF EXISTS search_messages(vector, uuid, integer, float);

-- Update the search_messages function to exclude soft deleted embeddings
CREATE OR REPLACE FUNCTION search_messages(
  query_embedding vector(1536),
  workspace_filter uuid,
  match_count int DEFAULT 5,
  similarity_threshold float DEFAULT 0.7
)
RETURNS TABLE (
  message_id uuid,
  content text,
  similarity float,
  channel_id uuid,
  created_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as message_id,
    m.content,
    (me.embedding <=> query_embedding) as similarity,
    m.channel_id,
    m.created_at,
    me.metadata
  FROM messages m
  INNER JOIN channels c ON m.channel_id = c.id
  INNER JOIN message_embeddings me ON m.id = me.message_id
  WHERE 
    c.workspace_id = workspace_filter
    AND NOT c.is_private
    AND me.is_latest = true  -- Only get latest version of embeddings
    AND NOT me.is_deleted    -- Exclude soft deleted embeddings
    AND (me.embedding <=> query_embedding) < (1 - similarity_threshold)
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add an index to improve query performance for soft delete checks
CREATE INDEX idx_message_embeddings_is_deleted 
ON message_embeddings(is_deleted) 
WHERE NOT is_deleted; 