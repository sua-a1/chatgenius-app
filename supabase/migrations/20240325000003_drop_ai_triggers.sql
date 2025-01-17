-- Drop all triggers from ai_assistant_messages
DROP TRIGGER IF EXISTS update_conversation_last_message_at_trigger ON ai_assistant_messages;
DROP TRIGGER IF EXISTS generate_message_embedding_trigger ON ai_assistant_messages;
DROP TRIGGER IF EXISTS handle_message_update_trigger ON ai_assistant_messages;
DROP TRIGGER IF EXISTS trigger_new_message_embedding ON ai_assistant_messages;

-- Drop all triggers from ai_assistant_conversations
DROP TRIGGER IF EXISTS update_conversation_timestamp_trigger ON ai_assistant_conversations;

-- Drop any trigger functions that might exist
DROP FUNCTION IF EXISTS update_conversation_last_message_at();
DROP FUNCTION IF EXISTS generate_message_embedding();
DROP FUNCTION IF EXISTS handle_message_update();
DROP FUNCTION IF EXISTS trigger_new_message_embedding(); 