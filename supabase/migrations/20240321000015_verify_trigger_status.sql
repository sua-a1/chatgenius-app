-- Check trigger status
SELECT 
    tgname as trigger_name,
    tgenabled as is_enabled,
    tgtype as trigger_type,
    proname as function_name,
    nspname as schema_name,
    relname as table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE tgname = 'generate_message_embedding_trigger'
AND relname = 'messages';

-- Test trigger with explicit notice
DO $$
BEGIN
    RAISE NOTICE E'\n\n[TEST] Testing notice visibility in logs\n\n';
END $$; 