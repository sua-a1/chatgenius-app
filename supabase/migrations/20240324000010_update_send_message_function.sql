-- Drop the old function
drop function if exists public.send_message(text, uuid, text);

-- Create new version of the channel message function that handles attachments and stores file metadata
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
    workspace_id_var uuid;
begin
    -- Get workspace_id from channel
    select workspace_id into workspace_id_var
    from public.channels
    where id = p_channel_id;

    -- Convert comma-separated attachments to JSON array of objects
    if p_attachments is not null then
        select jsonb_agg(jsonb_build_object(
            'url', url,
            'filename', split_part(url, '/', -1)
        ))
        from unnest(string_to_array(p_attachments, ',')) as url
        into attachments_json;
    end if;

    -- Insert the message with attachments first
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

    -- After message is created, store file metadata
    if p_attachments is not null then
        insert into public.files (
            user_id,
            workspace_id,
            channel_id,
            file_url,
            filename,
            file_type,
            file_size,
            metadata
        )
        select
            auth.uid(),
            workspace_id_var,
            p_channel_id,
            url,
            split_part(url, '/', -1),
            case
                when url like '%.jpg' or url like '%.jpeg' then 'image/jpeg'
                when url like '%.png' then 'image/png'
                when url like '%.gif' then 'image/gif'
                when url like '%.pdf' then 'application/pdf'
                when url like '%.doc' or url like '%.docx' then 'application/msword'
                when url like '%.txt' then 'text/plain'
                else 'application/octet-stream'
            end,
            0, -- We don't have file size at this point
            jsonb_build_object(
                'content_type', case
                    when url like '%.jpg' or url like '%.jpeg' then 'image/jpeg'
                    when url like '%.png' then 'image/png'
                    when url like '%.gif' then 'image/gif'
                    when url like '%.pdf' then 'application/pdf'
                    when url like '%.doc' or url like '%.docx' then 'application/msword'
                    when url like '%.txt' then 'text/plain'
                    else 'application/octet-stream'
                end,
                'extension', split_part(url, '.', -1),
                'original_name', split_part(url, '/', -1),
                'storage_path', url,
                'bucket', 'chat_attachments',
                'created_at', now(),
                'message_id', message_id
            )
        from unnest(string_to_array(p_attachments, ',')) as url;
    end if;

    return message_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.send_message(text, uuid, text) to authenticated; 