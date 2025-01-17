-- Check if trigger exists and show its configuration
SELECT 
    t.tgname as trigger_name,
    p.proname as function_name,
    t.tgenabled as trigger_enabled,
    t.tgtype as trigger_type
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
AND c.relname = 'messages'
AND t.tgname = 'generate_message_embedding_trigger';

-- Also verify the function exists
SELECT 
    p.proname as function_name,
    p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'generate_message_embedding'; 