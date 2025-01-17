-- Add version tracking columns to message_embeddings
ALTER TABLE message_embeddings
ADD COLUMN version integer NOT NULL DEFAULT 1,
ADD COLUMN is_latest boolean NOT NULL DEFAULT true,
ADD COLUMN replaced_at timestamptz,
ADD COLUMN original_message_content text;

-- Update existing embeddings to include original content
UPDATE message_embeddings me
SET original_message_content = m.content
FROM messages m
WHERE me.message_id = m.id;

-- Now make the column NOT NULL after populating it
ALTER TABLE message_embeddings
ALTER COLUMN original_message_content SET NOT NULL;

-- Create a unique constraint to ensure only one latest version per message
CREATE UNIQUE INDEX message_embeddings_latest_version_idx ON message_embeddings (message_id) WHERE is_latest = true;

-- Function to handle message updates
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
        error = null,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle message soft deletes
CREATE OR REPLACE FUNCTION handle_message_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark all embeddings for this message as not latest
    UPDATE message_embeddings
    SET is_latest = false,
        replaced_at = now()
    WHERE message_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS message_update_trigger ON messages;
CREATE TRIGGER message_update_trigger
    AFTER UPDATE OF content ON messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_message_update();

DROP TRIGGER IF EXISTS message_delete_trigger ON messages;
CREATE TRIGGER message_delete_trigger
    BEFORE DELETE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_message_delete();

-- Update the generate_message_embedding function to store original content
CREATE OR REPLACE FUNCTION generate_message_embedding()
RETURNS TRIGGER AS $$
BEGIN
    -- Queue the message for embedding generation
    INSERT INTO pending_embeddings (message_id, status, attempts)
    VALUES (NEW.id, 'pending', 0)
    ON CONFLICT (message_id) DO UPDATE
    SET status = 'pending',
        attempts = 0,
        error = null,
        updated_at = now();

    -- Log the trigger execution
    INSERT INTO function_logs (function_name, message_id, status)
    VALUES ('generate_message_embedding', NEW.id, 'queued');

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log any errors
    INSERT INTO function_logs (function_name, message_id, status, error_details)
    VALUES ('generate_message_embedding', NEW.id, 'error', jsonb_build_object(
        'error', SQLERRM,
        'state', SQLSTATE
    ));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql; 