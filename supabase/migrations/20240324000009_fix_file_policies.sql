-- Drop existing file policies
drop policy if exists "file_create" on public.files;
drop policy if exists "Users can upload files to channels they are members of" on public.files;
drop policy if exists "Users can upload files" on public.files;
drop policy if exists "Users can read files they have access to" on public.files;

-- Create new file insert policy that handles both channel and DM contexts
create policy "Users can upload files"
    on public.files for insert
    with check (
        user_id = auth.uid()
        and
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = files.workspace_id
            and user_id = auth.uid()
        )
        and
        (
            -- Channel context
            (
                channel_id is not null
                and direct_message_id is null
                and exists (
                    select 1 from public.channel_memberships cm
                    join public.channels c on c.id = cm.channel_id
                    where cm.channel_id = files.channel_id
                    and cm.user_id = auth.uid()
                    and c.workspace_id = files.workspace_id
                )
            )
            or
            -- DM context
            (
                channel_id is null
                and direct_message_id is not null
                and exists (
                    select 1 from public.direct_messages dm
                    where dm.workspace_id = files.workspace_id
                    and (dm.sender_id = auth.uid() or dm.receiver_id = auth.uid())
                )
            )
            or
            -- Workspace context (no channel or DM)
            (
                channel_id is null
                and direct_message_id is null
                and exists (
                    select 1 from public.workspace_memberships wm
                    where wm.workspace_id = files.workspace_id
                    and wm.user_id = auth.uid()
                )
            )
        )
    );

-- Create policy for reading files
create policy "Users can read files they have access to"
    on public.files for select
    using (
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = files.workspace_id
            and user_id = auth.uid()
        )
        and
        (
            -- Channel context
            (
                channel_id is not null
                and direct_message_id is null
                and exists (
                    select 1 from public.channel_memberships cm
                    join public.channels c on c.id = cm.channel_id
                    where cm.channel_id = files.channel_id
                    and cm.user_id = auth.uid()
                    and c.workspace_id = files.workspace_id
                )
            )
            or
            -- DM context
            (
                channel_id is null
                and direct_message_id is not null
                and exists (
                    select 1 from public.direct_messages dm
                    where dm.workspace_id = files.workspace_id
                    and (dm.sender_id = auth.uid() or dm.receiver_id = auth.uid())
                )
            )
            or
            -- Workspace context (no channel or DM)
            (
                channel_id is null
                and direct_message_id is null
                and exists (
                    select 1 from public.workspace_memberships wm
                    where wm.workspace_id = files.workspace_id
                    and wm.user_id = auth.uid()
                )
            )
        )
    );

-- Also ensure storage bucket policies are correct
drop policy if exists "Message attachments are accessible to workspace members or DM participants" on storage.objects;
create policy "Message attachments are accessible to workspace members or DM participants"
    on storage.objects for all
    using (
        bucket_id = 'message-attachments'
        and (
            -- Workspace channel context
            exists (
                select 1 from public.workspace_memberships wm
                join public.channels c on c.workspace_id = wm.workspace_id
                join public.channel_memberships cm on cm.channel_id = c.id
                where wm.workspace_id = (storage.foldername(name))[1]::uuid
                and wm.user_id = auth.uid()
                and cm.user_id = auth.uid()
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