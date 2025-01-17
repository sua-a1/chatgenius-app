-- Drop existing file insert policy
drop policy if exists "Users can upload files" on public.files;

-- Create new simplified file insert policy
create policy "Users can upload files"
    on public.files for insert
    with check (
        -- User must be authenticated
        auth.uid() = user_id
        and
        -- User must be a member of the workspace
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = files.workspace_id
            and user_id = auth.uid()
        )
        and
        -- For channel messages, user must be a member of the channel
        (
            channel_id is null
            or
            exists (
                select 1 from public.channel_memberships
                where channel_id = files.channel_id
                and user_id = auth.uid()
            )
        )
    ); 