-- Check message embedding status
WITH message_embeddings_latest AS (
  SELECT 
    m.id as message_id,
    m.content,
    me.embedding,
    me.created_at,
    ROW_NUMBER() OVER (PARTITION BY m.id ORDER BY me.created_at DESC) as rn
  FROM messages m
  LEFT JOIN message_embeddings me ON m.id = me.message_id
),
message_stats AS (
  SELECT 
    message_id,
    content,
    embedding,
    created_at,
    COUNT(*) OVER (PARTITION BY message_id) as embedding_chunks
  FROM message_embeddings_latest
  WHERE rn = 1 OR rn IS NULL
)
SELECT 
  message_id,
  SUBSTRING(content, 1, 50) as content_preview,
  embedding_chunks - 1 as embedding_chunks, -- Subtract 1 to account for NULL embeddings
  created_at as embedded_at,
  CASE 
    WHEN embedding IS NOT NULL THEN vector_dims(embedding)
    ELSE NULL
  END as embedding_dimension,
  CASE 
    WHEN embedding IS NOT NULL THEN 'Embedded'
    ELSE 'Pending'
  END as status
FROM message_stats
ORDER BY created_at DESC NULLS LAST;

-- Check metadata storage
SELECT 
  me.id,
  me.message_id,
  me.user_id,
  vector_dims(me.embedding) as embedding_dimension,
  me.created_at
FROM message_embeddings me
ORDER BY me.created_at DESC
LIMIT 5;

-- Test retrieval with placeholder embedding (1536 zeros to match text-embedding-ada-002)
WITH zero_vector AS (
  SELECT format('[%s]', string_agg('0', ',' ORDER BY g.i))::vector(1536) as vec
  FROM generate_series(1, 1536) g(i)
)
SELECT * FROM get_relevant_context(
  (SELECT vec FROM zero_vector),
  '123e4567-e89b-12d3-a456-426614174000',
  '123e4567-e89b-12d3-a456-426614174001',
  0.8,
  5
); 