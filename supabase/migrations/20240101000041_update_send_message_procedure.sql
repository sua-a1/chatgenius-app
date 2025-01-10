-- Drop the old function
drop function if exists public.send_direct_message(uuid, uuid, text);

-- Create a new version of the function that doesn't handle mentions
create or replace function public.send_direct_message(
    workspace_id uuid,
    receiver_id uuid,
    message_content text
) returns uuid
language plpgsql
security definer
as $$
declare
    message_id uuid;
begin
    -- Insert the message directly
    insert into public.direct_messages (
        workspace_id,
        sender_id,
        receiver_id,
        message,
        created_at
    ) values (
        workspace_id,
        auth.uid(),
        receiver_id,
        message_content,
        now()
    )
    returning id into message_id;

    return message_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.send_direct_message(uuid, uuid, text) to authenticated; 