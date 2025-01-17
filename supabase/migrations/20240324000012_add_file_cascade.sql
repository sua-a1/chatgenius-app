-- Drop any existing triggers
drop trigger if exists on_message_delete_cleanup_files on public.messages;
drop function if exists public.handle_message_file_cleanup();

-- Create function to handle file cleanup
create or replace function public.handle_message_file_cleanup()
returns trigger
language plpgsql
security definer
as $$
begin
    -- Delete files associated with the message
    delete from public.files
    where message_id = old.id
    or (metadata->>'message_id')::uuid = old.id;
    
    return old;
end;
$$;

-- Create trigger to cleanup files when a message is deleted
create trigger on_message_delete_cleanup_files
    before delete on public.messages
    for each row
    execute function public.handle_message_file_cleanup();

-- Add message_id column without constraint first
alter table public.files
    add column if not exists message_id uuid;

-- Create index for better performance
create index if not exists idx_files_message_id on public.files(message_id);

-- Update existing files to set message_id based on metadata
-- Only update where the referenced message exists
update public.files f
set message_id = (metadata->>'message_id')::uuid
from public.messages m
where f.metadata->>'message_id' is not null
and m.id = (f.metadata->>'message_id')::uuid;

-- Now add the foreign key constraint with cascade delete
alter table public.files drop constraint if exists files_message_id_fkey;
alter table public.files
    add constraint files_message_id_fkey 
    foreign key (message_id) 
    references public.messages(id) 
    on delete cascade;

-- Update the send_message function to use the new message_id column
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
            message_id,
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
            message_id,
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