-- Drop existing indexes
DROP INDEX IF EXISTS message_embeddings_latest_version_idx;
DROP INDEX IF EXISTS message_embeddings_latest_version_unique;

-- Create a trigger function to ensure only one latest version exists
CREATE OR REPLACE FUNCTION ensure_single_latest_version()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a new latest version, mark all other versions as not latest
    IF NEW.is_latest = true THEN
        UPDATE message_embeddings
        SET is_latest = false,
            replaced_at = NEW.created_at
        WHERE message_id = NEW.message_id
        AND id != NEW.id
        AND is_latest = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS message_embeddings_single_latest_trigger ON message_embeddings;
CREATE TRIGGER message_embeddings_single_latest_trigger
    BEFORE INSERT OR UPDATE OF is_latest
    ON message_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_latest_version();

-- Update the handle_message_update function to use simpler logic
CREATE OR REPLACE FUNCTION handle_message_update()
RETURNS TRIGGER AS $$
DECLARE
    current_ts timestamptz;
    channel_workspace_id uuid;
    latest_version int;
BEGIN
    -- If content hasn't changed, no need to create new embedding
    IF OLD.content = NEW.content THEN
        RETURN NEW;
    END IF;

    -- Get current timestamp for consistency
    SELECT now() INTO current_ts;

    -- Get workspace_id for the channel
    SELECT workspace_id INTO channel_workspace_id
    FROM channels
    WHERE id = NEW.channel_id;

    -- Get latest version number
    SELECT COALESCE(MAX(version), 0) INTO latest_version
    FROM message_embeddings
    WHERE message_id = NEW.id;

    -- Insert new version (trigger will handle marking old version as not latest)
    INSERT INTO message_embeddings (
        message_id,
        version,
        is_latest,
        is_deleted,
        deleted_at,
        replaced_at,
        original_message_content,
        channel_id,
        user_id,
        workspace_id,
        metadata,
        embedding,
        created_at
    ) VALUES (
        NEW.id,
        latest_version + 1,
        true,
        false,
        null,
        null,
        NEW.content,
        NEW.channel_id,
        NEW.user_id,
        channel_workspace_id,
        jsonb_build_object(
            'previous_content', OLD.content,
            'previous_version', latest_version,
            'updated_at', current_ts
        ),
        null,
        current_ts
    );

    -- Queue message for new embedding generation
    INSERT INTO pending_embeddings (message_id, status, attempts)
    VALUES (NEW.id, 'pending', 0)
    ON CONFLICT (message_id) DO UPDATE
    SET status = 'pending',
        attempts = 0,
        error_message = null,
        updated_at = current_ts;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the message update trigger
DROP TRIGGER IF EXISTS message_update_trigger ON messages;
CREATE TRIGGER message_update_trigger
    AFTER UPDATE OF content ON messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_message_update(); 