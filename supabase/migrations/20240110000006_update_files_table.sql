-- Add direct_message_id to files table
alter table public.files
add column direct_message_id uuid references public.direct_messages(id) on delete cascade,
add constraint file_context_check 
  check (
    (channel_id is not null and direct_message_id is null) or
    (channel_id is null and direct_message_id is not null) or
    (channel_id is null and direct_message_id is null)
  );

-- Update file policies to include direct message context
drop policy if exists "file_read" on public.files;
create policy "file_read"
    on public.files
    for select
    using (
        -- User owns the file
        user_id = auth.uid()
        or
        -- File is in a channel user is member of
        (
            channel_id is not null
            and exists (
                select 1 from public.channel_memberships
                where channel_id = files.channel_id
                and user_id = auth.uid()
            )
        )
        or
        -- File is in a DM where user is participant
        (
            direct_message_id is not null
            and exists (
                select 1 from public.direct_messages dm
                where dm.id = files.direct_message_id
                and (dm.sender_id = auth.uid() or dm.receiver_id = auth.uid())
            )
        )
        or
        -- File is in workspace and user is member (for workspace-level files)
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

-- Update storage policies for message attachments to include DM context
drop policy if exists "Message attachments are accessible to workspace members" on storage.objects;
create policy "Message attachments are accessible to workspace members or DM participants"
    on storage.objects for select
    using (
        bucket_id = 'message-attachments'
        and (
            -- Workspace channel context
            exists (
                select 1 from public.workspace_memberships
                where workspace_id = (storage.foldername(name))[1]::uuid
                and user_id = auth.uid()
            )
            or
            -- DM context
            exists (
                select 1 from public.direct_messages dm
                where dm.workspace_id = (storage.foldername(name))[1]::uuid
                and (dm.sender_id = auth.uid() or dm.receiver_id = auth.uid())
            )
        )
    ); 