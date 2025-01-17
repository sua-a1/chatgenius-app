-- Check the message
SELECT m.id, m.content, m.created_at, c.is_private
FROM messages m
JOIN channels c ON m.channel_id = c.id
WHERE m.id = '595f0309-57de-454f-8a0e-bbc5ff000ee5';

-- Check pending_embeddings status
SELECT *
FROM pending_embeddings
WHERE message_id = '595f0309-57de-454f-8a0e-bbc5ff000ee5';

-- Check message_embeddings table
SELECT *
FROM message_embeddings
WHERE message_id = '595f0309-57de-454f-8a0e-bbc5ff000ee5';

-- Check if message_embeddings table exists and its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'message_embeddings'; 