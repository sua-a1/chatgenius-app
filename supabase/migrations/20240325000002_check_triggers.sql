-- Query to view all triggers
SELECT 
    event_object_table as table_name,
    trigger_name,
    event_manipulation as event,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_schema = 'public'
    AND event_object_table IN ('ai_assistant_messages', 'ai_assistant_conversations')
ORDER BY event_object_table, trigger_name; 