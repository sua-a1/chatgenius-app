-- First add soft delete columns if they don't exist
ALTER TABLE message_embeddings
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Drop existing foreign key constraint
ALTER TABLE message_embeddings
DROP CONSTRAINT IF EXISTS message_embeddings_message_id_fkey;

-- Re-add with ON DELETE CASCADE
ALTER TABLE message_embeddings
ADD CONSTRAINT message_embeddings_message_id_fkey
FOREIGN KEY (message_id)
REFERENCES messages(id)
ON DELETE CASCADE;

-- Update message delete trigger to properly handle soft deletes
CREATE OR REPLACE FUNCTION handle_message_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Soft delete message embeddings
    UPDATE message_embeddings
    SET is_deleted = true,
        deleted_at = now(),
        is_latest = false
    WHERE message_id = OLD.id;

    -- Delete any pending embeddings (CASCADE will handle this)
    DELETE FROM pending_embeddings
    WHERE message_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS message_delete_trigger ON messages;
CREATE TRIGGER message_delete_trigger
    BEFORE DELETE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_message_delete(); 