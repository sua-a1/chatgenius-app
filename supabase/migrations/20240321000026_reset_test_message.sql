-- Reset the test message
UPDATE pending_embeddings
SET 
    status = 'pending',
    attempts = 0,
    error_message = null,
    last_attempt = null,
    updated_at = now()
WHERE message_id = '595f0309-57de-454f-8a0e-bbc5ff000ee5';

-- Delete any existing embeddings for this message
DELETE FROM message_embeddings
WHERE message_id = '595f0309-57de-454f-8a0e-bbc5ff000ee5'; 