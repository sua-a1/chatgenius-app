-- Drop the old function
drop function if exists public.send_direct_message(uuid, uuid, text);
drop function if exists public.send_direct_message(text, uuid, uuid, text);
drop function if exists public.send_message(text, uuid, text);

-- Create new version of the direct message function that handles attachments
create or replace function public.send_direct_message(
    p_content text,
    p_receiver_id uuid,
    p_workspace_id uuid,
    p_attachments text default null
) returns uuid
language plpgsql
security definer
as $$
declare
    message_id uuid;
    attachments_json jsonb;
begin
    -- Convert comma-separated attachments to JSON array of objects
    if p_attachments is not null then
        select jsonb_agg(jsonb_build_object(
            'url', url,
            'filename', split_part(url, '/', -1)
        ))
        from unnest(string_to_array(p_attachments, ',')) as url
        into attachments_json;
    end if;

    -- Insert the message with attachments
    insert into public.direct_messages (
        workspace_id,
        sender_id,
        receiver_id,
        message,
        attachments,
        created_at
    ) values (
        p_workspace_id,
        auth.uid(),
        p_receiver_id,
        p_content,
        attachments_json,
        now()
    )
    returning id into message_id;

    return message_id;
end;
$$;

-- Create new version of the channel message function that handles attachments
create or replace function public.send_message(
    p_content text,
    p_channel_id uuid,
    p_attachments text default null
) returns uuid
language plpgsql
security definer
as $$
declare
    message_id uuid;
    attachments_json jsonb;
begin
    -- Convert comma-separated attachments to JSON array of objects
    if p_attachments is not null then
        select jsonb_agg(jsonb_build_object(
            'url', url,
            'filename', split_part(url, '/', -1)
        ))
        from unnest(string_to_array(p_attachments, ',')) as url
        into attachments_json;
    end if;

    -- Insert the message with attachments
    insert into public.messages (
        channel_id,
        user_id,
        content,
        attachments,
        created_at,
        updated_at
    ) values (
        p_channel_id,
        auth.uid(),
        p_content,
        attachments_json,
        now(),
        now()
    )
    returning id into message_id;

    return message_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.send_direct_message(text, uuid, uuid, text) to authenticated;
grant execute on function public.send_message(text, uuid, text) to authenticated; 