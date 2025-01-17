-- Get a non-private channel ID
DO $$
DECLARE
    test_channel_id uuid;
    test_user_id uuid;
BEGIN
    -- Get first non-private channel
    SELECT id INTO test_channel_id 
    FROM channels 
    WHERE is_private = false 
    LIMIT 1;

    -- Get first user
    SELECT id INTO test_user_id
    FROM auth.users
    LIMIT 1;

    IF test_channel_id IS NOT NULL AND test_user_id IS NOT NULL THEN
        RAISE NOTICE E'\n\n[TEST] Inserting test message into channel: %\n\n', test_channel_id;
        
        -- Insert test message
        INSERT INTO messages (channel_id, user_id, content)
        VALUES (test_channel_id, test_user_id, 'Test message for embedding trigger ' || now());
    ELSE
        RAISE NOTICE E'\n\n[ERROR] Could not find non-private channel or user for test\n\n';
    END IF;
END $$; 