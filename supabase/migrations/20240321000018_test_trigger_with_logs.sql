-- Insert test message
DO $$
DECLARE
    test_channel_id uuid;
    test_user_id uuid;
    inserted_message_id uuid;
    log_record record;
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
        -- Insert test message
        INSERT INTO messages (channel_id, user_id, content)
        VALUES (test_channel_id, test_user_id, 'Test message for embedding trigger ' || now())
        RETURNING id INTO inserted_message_id;

        -- Wait a moment for trigger to complete
        PERFORM pg_sleep(2);

        -- Check trigger logs
        RAISE NOTICE 'Checking trigger logs for message %:', inserted_message_id;
        
        FOR log_record IN 
            SELECT step, details::text, created_at
            FROM trigger_logs
            WHERE message_id = inserted_message_id
            ORDER BY created_at ASC
        LOOP
            RAISE NOTICE E'\n%: %\n%', log_record.step, log_record.created_at, log_record.details;
        END LOOP;
    ELSE
        RAISE NOTICE 'Could not find non-private channel or user for test';
    END IF;
END $$; 