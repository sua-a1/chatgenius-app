-- Drop old function
DROP FUNCTION IF EXISTS public.reply_to_message(uuid, text);

-- Update thread reply function
CREATE OR REPLACE FUNCTION public.create_thread_reply(
    thread_parent_id uuid,
    message_content text,
    attachments jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    channel_id_var uuid;
    workspace_id_var uuid;
    new_message_id uuid;
BEGIN
    -- Get channel ID, workspace ID and verify access in one step
    SELECT m.channel_id, c.workspace_id INTO channel_id_var, workspace_id_var
    FROM messages m
    JOIN channels c ON c.id = m.channel_id
    JOIN channel_memberships cm ON cm.channel_id = m.channel_id
    WHERE m.id = thread_parent_id
    AND cm.user_id = auth.uid();

    IF channel_id_var IS NULL THEN
        RAISE EXCEPTION 'Access denied or parent message not found';
    END IF;

    -- Insert the reply with all required fields
    INSERT INTO messages (
        channel_id,
        user_id,
        content,
        reply_to,
        reply_count,
        attachments,
        created_at,
        updated_at
    ) VALUES (
        channel_id_var,
        auth.uid(),
        message_content,
        thread_parent_id,
        0,
        attachments,
        now(),
        now()
    ) RETURNING id INTO new_message_id;

    -- Update parent message reply count
    UPDATE messages
    SET reply_count = reply_count + 1
    WHERE id = thread_parent_id;

    -- Log the function execution
    INSERT INTO function_logs (
        function_name,
        message_id,
        status
    ) VALUES (
        'create_thread_reply',
        new_message_id,
        'success'
    );

    RETURN new_message_id;
EXCEPTION WHEN OTHERS THEN
    -- Log any errors
    INSERT INTO function_logs (
        function_name,
        message_id,
        status,
        error_details
    ) VALUES (
        'create_thread_reply',
        thread_parent_id,
        'error',
        jsonb_build_object(
            'error', SQLERRM,
            'state', SQLSTATE
        )
    );
    RAISE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_thread_reply(uuid, text, jsonb) TO authenticated; 