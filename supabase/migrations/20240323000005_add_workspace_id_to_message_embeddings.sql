-- Add workspace_id column to message_embeddings (initially nullable)
ALTER TABLE message_embeddings
ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- Create temporary function to get workspace_id for a channel
CREATE OR REPLACE FUNCTION get_channel_workspace_id(channel_id_param uuid)
RETURNS uuid AS $$
BEGIN
    RETURN (
        SELECT workspace_id 
        FROM channels 
        WHERE id = channel_id_param
    );
END;
$$ LANGUAGE plpgsql;

-- Update existing records with workspace_id from channels
UPDATE message_embeddings me
SET workspace_id = get_channel_workspace_id(me.channel_id)
WHERE me.workspace_id IS NULL;

-- Drop existing constraint and index if they exist
ALTER TABLE message_embeddings
DROP CONSTRAINT IF EXISTS message_embeddings_workspace_id_fkey;

DROP INDEX IF EXISTS message_embeddings_workspace_id_idx;

-- Make workspace_id NOT NULL after populating it
DO $$ 
BEGIN
    ALTER TABLE message_embeddings
    ALTER COLUMN workspace_id SET NOT NULL;
EXCEPTION
    WHEN others THEN
        NULL; -- Column might already be NOT NULL
END $$;

-- Add foreign key constraint
ALTER TABLE message_embeddings
ADD CONSTRAINT message_embeddings_workspace_id_fkey
FOREIGN KEY (workspace_id)
REFERENCES workspaces(id)
ON DELETE CASCADE;

-- Create index for workspace_id
CREATE INDEX message_embeddings_workspace_id_idx 
ON message_embeddings(workspace_id);

-- Update message update trigger to properly handle versioning and soft deletes
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
END;
$$ LANGUAGE plpgsql;

-- Drop temporary function
DROP FUNCTION IF EXISTS get_channel_workspace_id; 