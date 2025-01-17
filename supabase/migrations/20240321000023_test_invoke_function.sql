-- First, check if we have any pending messages
SELECT count(*) as pending_count FROM pending_embeddings WHERE status = 'pending';

-- Invoke the edge function and see raw output
SELECT *
FROM 
    net.http_get('https://clohwjjmidcucvvxgxaf.supabase.co/functions/v1/generate-embeddings');

-- Wait a moment
SELECT pg_sleep(2);

-- Check results
SELECT 
    status,
    message_id,
    error_message,
    attempts,
    created_at,
    updated_at
FROM pending_embeddings
ORDER BY created_at DESC
LIMIT 5; 