-- First, clean up duplicates by keeping only the most recent pending embedding for each message
WITH duplicates AS (
    SELECT message_id, 
           id,
           ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY updated_at DESC) as rn
    FROM pending_embeddings
)
DELETE FROM pending_embeddings
WHERE id IN (
    SELECT id 
    FROM duplicates 
    WHERE rn > 1
);

-- Add unique constraint on message_id in pending_embeddings
ALTER TABLE pending_embeddings
ADD CONSTRAINT pending_embeddings_message_id_key UNIQUE (message_id);

-- Update message update trigger to handle conflicts properly
CREATE OR REPLACE FUNCTION handle_message_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If content hasn't changed, no need to create new embedding
    IF OLD.content = NEW.content THEN
        RETURN NEW;
    END IF;

    -- Mark existing embedding as not latest
    UPDATE message_embeddings
    SET is_latest = false,
        replaced_at = now()
    WHERE message_id = NEW.id AND is_latest = true;

    -- Queue message for new embedding generation
    INSERT INTO pending_embeddings (message_id, status, attempts)
    VALUES (NEW.id, 'pending', 0)
    ON CONFLICT (message_id) DO UPDATE
    SET status = 'pending',
        attempts = 0,
        error_message = null,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS message_update_trigger ON messages;
CREATE TRIGGER message_update_trigger
    AFTER UPDATE OF content ON messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_message_update(); 