-- First, let's check the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages';

-- Check messages pending embedding
WITH message_stats AS (
    SELECT 
        m.id,
        SUBSTRING(m.content, 1, 50) as content_preview,
        m.channel_id,
        c.workspace_id,
        m.topic,
        m.user_id,
        m.created_at,
        CASE 
            WHEN me.id IS NOT NULL THEN 'Embedded'
            ELSE 'Pending'
        END as status,
        me.embedding IS NOT NULL as has_embedding,
        CASE 
            WHEN me.embedding IS NOT NULL THEN vector_dims(me.embedding)
            ELSE NULL
        END as embedding_dimension
    FROM messages m
    LEFT JOIN channels c ON c.id = m.channel_id
    LEFT JOIN message_embeddings me ON me.message_id = m.id
    WHERE NOT c.is_private  -- Only show messages from non-private channels
)
SELECT 
    id,
    content_preview,
    channel_id,
    workspace_id,
    topic,
    user_id,
    created_at,
    status,
    CASE 
        WHEN has_embedding THEN embedding_dimension::text
        ELSE 'N/A'
    END as embedding_dimension
FROM message_stats
ORDER BY created_at DESC
LIMIT 10; 