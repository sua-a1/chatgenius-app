-- Drop and recreate the unique index to ensure we have the correct constraint
DROP INDEX IF EXISTS message_embeddings_latest_version_idx;
CREATE UNIQUE INDEX message_embeddings_latest_version_idx ON message_embeddings (message_id) WHERE is_latest = true;

-- Update the handle_message_update function to properly handle versioning
CREATE OR REPLACE FUNCTION handle_message_update()
RETURNS TRIGGER AS $$
DECLARE
    current_version integer;
    current_ts timestamptz;
    channel_workspace_id uuid;
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

    -- Get current version
    SELECT COALESCE(MAX(version), 0) INTO current_version
    FROM message_embeddings
    WHERE message_id = NEW.id;

    -- Use a transaction to ensure atomicity
    BEGIN
        -- First mark existing embeddings as not latest
        UPDATE message_embeddings
        SET is_latest = false,
            replaced_at = current_ts
        WHERE message_id = NEW.id
        AND is_latest = true;

        -- Then insert new version
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
        VALUES (
            NEW.id,
            current_version + 1,
            true,           -- is_latest
            false,          -- is_deleted
            null,           -- deleted_at
            null,           -- replaced_at (this is the latest version)
            NEW.content,    -- original_message_content
            NEW.channel_id,
            NEW.user_id,
            channel_workspace_id,
            jsonb_build_object(
                'previous_content', OLD.content,
                'previous_version', current_version,
                'updated_at', current_ts
            ),
            null            -- embedding (will be populated later)
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
    EXCEPTION 
        WHEN unique_violation THEN
            -- If we hit a unique violation, try one more time with a small delay
            PERFORM pg_sleep(0.1);
            
            UPDATE message_embeddings
            SET is_latest = false,
                replaced_at = current_ts
            WHERE message_id = NEW.id
            AND is_latest = true;

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
                embedding
            )
            VALUES (
                NEW.id,
                current_version + 1,
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
                    'previous_version', current_version,
                    'updated_at', current_ts
                ),
                null
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
END;
$$ LANGUAGE plpgsql; 