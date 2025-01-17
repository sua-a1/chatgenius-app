-- First drop the existing foreign key constraint
ALTER TABLE ai_assistant_messages
DROP CONSTRAINT IF EXISTS ai_assistant_messages_conversation_id_fkey;

-- Re-add the constraint with ON DELETE CASCADE
ALTER TABLE ai_assistant_messages
ADD CONSTRAINT ai_assistant_messages_conversation_id_fkey
FOREIGN KEY (conversation_id)
REFERENCES ai_assistant_conversations(id)
ON DELETE CASCADE; 