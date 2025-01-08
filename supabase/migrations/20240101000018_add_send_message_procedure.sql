-- Drop existing policies
drop policy if exists "direct_messages_insert" on public.direct_messages;
drop policy if exists "direct_messages_select" on public.direct_messages;
drop policy if exists "direct_messages_update" on public.direct_messages;
drop policy if exists "direct_messages_delete" on public.direct_messages;

-- Create stored procedure for sending messages
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

-- Create simple read-only policies for direct messages
create policy "direct_messages_select"
    on public.direct_messages
    for select
    using (
        sender_id = auth.uid()
        or
        receiver_id = auth.uid()
    );

create policy "direct_messages_delete"
    on public.direct_messages
    for delete
    using (sender_id = auth.uid()); 