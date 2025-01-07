-- First drop all existing policies
drop policy if exists "Users can view channel memberships they are part of" on public.channel_memberships;
drop policy if exists "Workspace admins can manage channel memberships" on public.channel_memberships;
drop policy if exists "Workspace admins can delete channel memberships" on public.channel_memberships;
drop policy if exists "Workspace admins can update channel memberships" on public.channel_memberships;
drop policy if exists "Workspace admins can update channels" on public.channels;

-- Add a single, simple policy for channel memberships
create policy "Channel membership access"
    on public.channel_memberships
    for all
    using (
        -- User is a workspace admin/owner
        exists (
            select 1 from public.workspace_memberships wm
            join public.channels c on c.workspace_id = wm.workspace_id
            where c.id = channel_id
            and wm.user_id = auth.uid()
            and wm.role in ('admin', 'owner')
        )
        or
        -- User is a member of the channel
        user_id = auth.uid()
    )
    with check (
        -- Only workspace admins/owners can modify
        exists (
            select 1 from public.workspace_memberships wm
            join public.channels c on c.workspace_id = wm.workspace_id
            where c.id = channel_id
            and wm.user_id = auth.uid()
            and wm.role in ('admin', 'owner')
        )
    );

-- Simple policy for channels update
create policy "Channel management"
    on public.channels
    for all
    using (
        -- User is a workspace admin/owner
        exists (
            select 1 from public.workspace_memberships wm
            where wm.workspace_id = workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('admin', 'owner')
        )
        or
        -- User is a member of the channel
        exists (
            select 1 from public.channel_memberships cm
            where cm.channel_id = id
            and cm.user_id = auth.uid()
        )
        or
        -- Channel is public and user is workspace member
        (
            not is_private
            and exists (
                select 1 from public.workspace_memberships wm
                where wm.workspace_id = workspace_id
                and wm.user_id = auth.uid()
            )
        )
    )
    with check (
        -- Only workspace admins/owners can modify
        exists (
            select 1 from public.workspace_memberships wm
            where wm.workspace_id = workspace_id
            and wm.user_id = auth.uid()
            and wm.role in ('admin', 'owner')
        )
    ); 