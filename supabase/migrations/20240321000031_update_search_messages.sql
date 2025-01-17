-- Drop all versions of search_messages function
DROP FUNCTION IF EXISTS search_messages(vector, uuid);
DROP FUNCTION IF EXISTS search_messages(vector, uuid, integer);
DROP FUNCTION IF EXISTS search_messages(vector, uuid, integer, float);
DROP FUNCTION IF EXISTS search_messages(vector, jsonb, integer);

-- Recreate the function with versioning support
CREATE OR REPLACE FUNCTION search_messages(
  query_embedding vector(1536),
  filter jsonb DEFAULT '{}',
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    jsonb_build_object(
      'workspace_id', c.workspace_id,
      'channel_id', m.channel_id,
      'channel_name', c.name,
      'created_at', m.created_at,
      'user_id', m.user_id,
      'username', COALESCE(u.username, ''),
      'full_name', COALESCE(u.full_name, ''),
      'user_email', COALESCE(u.email, ''),
      'user_avatar_url', COALESCE(u.avatar_url, '')
    ) as metadata,
    1 - (me.embedding <=> query_embedding) as similarity
  FROM messages m
  INNER JOIN channels c ON m.channel_id = c.id
  INNER JOIN message_embeddings me ON m.id = me.message_id
  LEFT JOIN users u ON m.user_id = u.id  -- Changed to LEFT JOIN to ensure we get messages even if user is deleted
  WHERE 
    me.is_latest = true  -- Only get latest version of embeddings
    AND NOT me.is_deleted -- Exclude deleted embeddings
    AND CASE 
      WHEN filter->>'workspace_id' IS NOT NULL THEN
        c.workspace_id = (filter->>'workspace_id')::uuid
      ELSE true
    END
    AND CASE 
      WHEN filter->>'channel_name' IS NOT NULL THEN
        LOWER(c.name) = LOWER(filter->>'channel_name')
      ELSE true
    END
    AND CASE 
      WHEN filter->>'user_id' IS NOT NULL THEN
        m.user_id = (filter->>'user_id')::uuid
      ELSE true
    END
    AND CASE
      WHEN filter->>'created_at_gte' IS NOT NULL THEN
        m.created_at >= (filter->>'created_at_gte')::timestamptz
      ELSE true
    END
    AND CASE
      WHEN filter->>'created_at_lte' IS NOT NULL THEN
        m.created_at <= (filter->>'created_at_lte')::timestamptz
      ELSE true
    END
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
END;
$$; 