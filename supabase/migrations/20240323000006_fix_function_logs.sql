-- Create function_logs table
CREATE TABLE IF NOT EXISTS function_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name text NOT NULL,
    message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
    status text NOT NULL,
    error_details jsonb,
    created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX function_logs_message_id_idx ON function_logs(message_id);

-- Update the generate_message_embedding function to use the new table
CREATE OR REPLACE FUNCTION generate_message_embedding()
RETURNS TRIGGER AS $$
BEGIN
    -- Queue the message for embedding generation
    INSERT INTO pending_embeddings (message_id, status, attempts)
    VALUES (NEW.id, 'pending', 0)
    ON CONFLICT (message_id) DO UPDATE
    SET status = 'pending',
        attempts = 0,
        error_message = null,
        updated_at = now();

    -- Log the trigger execution
    INSERT INTO function_logs (function_name, message_id, status)
    VALUES ('generate_message_embedding', NEW.id, 'queued');

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log any errors
    INSERT INTO function_logs (function_name, message_id, status, error_details)
    VALUES ('generate_message_embedding', NEW.id, 'error', jsonb_build_object(
        'error', SQLERRM,
        'state', SQLSTATE
    ));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update or create the reply_to_message function
CREATE OR REPLACE FUNCTION public.reply_to_message(
    thread_id uuid,
    content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    channel_id_var uuid;
    workspace_id_var uuid;
    new_message_id uuid;
BEGIN
    -- Get the channel_id and workspace_id from the parent message
    SELECT m.channel_id, c.workspace_id 
    INTO channel_id_var, workspace_id_var
    FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    WHERE m.id = thread_id;

    IF channel_id_var IS NULL THEN
        RAISE EXCEPTION 'Parent message not found';
    END IF;

    -- Check if user has access to the channel
    IF NOT EXISTS (
        SELECT 1 
        FROM public.channel_memberships cm
        WHERE cm.channel_id = channel_id_var
        AND cm.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Insert the reply with all required fields
    INSERT INTO public.messages (
        channel_id,
        user_id,
        content,
        reply_to,
        reply_count,
        created_at,
        updated_at
    ) VALUES (
        channel_id_var,
        auth.uid(),
        content,
        thread_id,
        0,
        now(),
        now()
    )
    RETURNING id INTO new_message_id;

    -- Update parent message reply count
    UPDATE public.messages
    SET reply_count = reply_count + 1
    WHERE id = thread_id;

    RETURN new_message_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.reply_to_message(uuid, text) TO authenticated; 