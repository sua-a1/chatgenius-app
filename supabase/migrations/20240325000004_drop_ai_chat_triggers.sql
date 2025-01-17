-- Drop all embedding-related triggers from ai_assistant_messages
DROP TRIGGER IF EXISTS ai_chat_message_delete_trigger ON ai_assistant_messages;
DROP TRIGGER IF EXISTS ai_chat_message_embedding_trigger ON ai_assistant_messages;
DROP TRIGGER IF EXISTS ai_chat_message_update_trigger ON ai_assistant_messages;
DROP TRIGGER IF EXISTS ai_message_embedding_trigger ON ai_assistant_messages;
DROP TRIGGER IF EXISTS generate_ai_chat_embedding_trigger ON ai_assistant_messages;
DROP TRIGGER IF EXISTS queue_ai_chat_message_embedding_trigger ON ai_assistant_messages;
DROP TRIGGER IF EXISTS update_conversation_last_message_at_trigger ON ai_assistant_messages;

-- Drop associated functions
DROP FUNCTION IF EXISTS handle_ai_chat_message_delete();
DROP FUNCTION IF EXISTS queue_ai_chat_message_for_embedding();
DROP FUNCTION IF EXISTS handle_ai_chat_message_update();
DROP FUNCTION IF EXISTS generate_ai_message_embedding();
DROP FUNCTION IF EXISTS generate_ai_chat_embedding();
DROP FUNCTION IF EXISTS update_conversation_last_message_at(); 