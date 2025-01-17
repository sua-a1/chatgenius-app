-- Update message update trigger to properly handle versioning and soft deletes
CREATE OR REPLACE FUNCTION handle_message_update()
RETURNS TRIGGER AS $$
DECLARE
    current_version integer;
    current_ts timestamptz;
BEGIN
    -- If content hasn't changed, no need to create new embedding
    IF OLD.content = NEW.content THEN
        RETURN NEW;
    END IF;

    -- Get current timestamp for consistency
    SELECT now() INTO current_ts;

    -- Get current version
    SELECT COALESCE(MAX(version), 0) INTO current_version
    FROM message_embeddings
    WHERE message_id = NEW.id;

    -- Mark ALL existing embeddings for this message as not latest
    UPDATE message_embeddings
    SET is_latest = false,
        replaced_at = current_ts
    WHERE message_id = NEW.id;

    -- Create new version of the embedding with all required columns
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
        embedding -- set to null, will be populated by the embedding generation process
    )
    SELECT 
        NEW.id,
        current_version + 1,
        true,           -- is_latest
        false,          -- is_deleted
        null,           -- deleted_at
        null,           -- replaced_at (this is the latest version)
        NEW.content,    -- original_message_content
        NEW.channel_id,
        NEW.user_id,
        c.workspace_id,
        jsonb_build_object(
            'previous_content', OLD.content,
            'previous_version', current_version,
            'updated_at', current_ts
        ),
        null            -- embedding (will be populated later)
    FROM channels c
    WHERE c.id = NEW.channel_id;

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

-- Recreate the trigger
DROP TRIGGER IF EXISTS message_update_trigger ON messages;
CREATE TRIGGER message_update_trigger
    AFTER UPDATE OF content ON messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_message_update(); 