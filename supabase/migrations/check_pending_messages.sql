-- Check messages pending embedding
WITH message_stats AS (
  SELECT 
    m.id,
    SUBSTRING(m.content, 1, 50) as content_preview,
    m.channel_id,
    c.workspace_id,
    m.created_at,
    CASE 
      WHEN me.id IS NOT NULL THEN 'Embedded'
      ELSE 'Pending'
    END as status
  FROM messages m
  JOIN channels c ON c.id = m.channel_id
  LEFT JOIN message_embeddings me ON me.message_id = m.id
  WHERE NOT c.is_private
  ORDER BY m.created_at DESC
  LIMIT 10
)
SELECT * FROM message_stats; 