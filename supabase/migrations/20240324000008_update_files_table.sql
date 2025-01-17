-- Add new columns to files table
alter table public.files
add column if not exists file_type text,
add column if not exists file_size bigint,
add column if not exists metadata jsonb default '{}'::jsonb;

-- Update existing files to have a default file type based on extension
update public.files
set file_type = case
  when lower(filename) like '%.jpg' or lower(filename) like '%.jpeg' then 'image/jpeg'
  when lower(filename) like '%.png' then 'image/png'
  when lower(filename) like '%.gif' then 'image/gif'
  when lower(filename) like '%.pdf' then 'application/pdf'
  when lower(filename) like '%.doc' then 'application/msword'
  when lower(filename) like '%.docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  when lower(filename) like '%.txt' then 'text/plain'
  when lower(filename) like '%.mp3' then 'audio/mpeg'
  when lower(filename) like '%.wav' then 'audio/wav'
  when lower(filename) like '%.mp4' then 'video/mp4'
  when lower(filename) like '%.webm' then 'video/webm'
  else 'application/octet-stream'
end
where file_type is null;

-- Create an index on file_type for faster queries
create index if not exists idx_files_file_type on public.files(file_type);

-- Create a GIN index on metadata for faster JSON queries
create index if not exists idx_files_metadata on public.files using gin(metadata);

-- Update RLS policies to ensure they work with new columns
drop policy if exists "Users can read files they have access to" on public.files;
create policy "Users can read files they have access to"
    on public.files for select
    using (
        user_id = auth.uid()
        or
        (
            channel_id is not null
            and exists (
                select 1 from public.channel_memberships
                where channel_id = files.channel_id
                and user_id = auth.uid()
            )
        )
        or
        (
            direct_message_id is not null
            and exists (
                select 1 from public.direct_messages dm
                where dm.id = files.direct_message_id
                and (dm.sender_id = auth.uid() or dm.receiver_id = auth.uid())
            )
        )
        or
        (
            channel_id is null
            and direct_message_id is null
            and exists (
                select 1 from public.workspace_memberships
                where workspace_id = files.workspace_id
                and user_id = auth.uid()
            )
        )
    ); 