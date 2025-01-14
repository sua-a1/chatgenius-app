-- Check message embedding status
SELECT 
  m.id as message_id,
  SUBSTRING(m.content, 1, 50) as content_preview,
  CASE 
    WHEN me.id IS NOT NULL THEN 'Embedded'
    ELSE 'Pending'
  END as status,
  me.created_at as embedded_at,
  CASE 
    WHEN me.embedding IS NOT NULL THEN vector_dims(me.embedding)
    ELSE NULL
  END as embedding_dimension
FROM messages m
LEFT JOIN message_embeddings me ON m.id = me.message_id
ORDER BY me.created_at DESC NULLS LAST
LIMIT 10; 