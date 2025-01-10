-- Drop all existing policies
drop policy if exists "Users can view their own profile" on public.users;
drop policy if exists "Users can update their own profile" on public.users;
drop policy if exists "Users can view workspaces they are members of" on public.workspaces;
drop policy if exists "Workspace owners can update their workspaces" on public.workspaces;
drop policy if exists "Users can view workspace memberships they are part of" on public.workspace_memberships;
drop policy if exists "Users can view channels they are members of" on public.channels;
drop policy if exists "Users can view channel memberships they are part of" on public.channel_memberships;
drop policy if exists "Users can view messages in channels they are members of" on public.messages;
drop policy if exists "Users can create messages in channels they are members of" on public.messages;
drop policy if exists "Users can update their own messages" on public.messages;
drop policy if exists "Users can view their direct messages" on public.direct_messages;
drop policy if exists "Users can send direct messages to workspace members" on public.direct_messages;
drop policy if exists "Users can view files in channels they are members of" on public.files;
drop policy if exists "Channel management" on public.channels;
drop policy if exists "Channel membership access" on public.channel_memberships;
drop policy if exists "Channel membership management" on public.channel_memberships;
drop policy if exists "Workspace membership access" on public.workspace_memberships;
drop policy if exists "Workspace access" on public.workspaces;
drop policy if exists "Message access" on public.messages;
drop policy if exists "Message write" on public.messages;
drop policy if exists "Message update" on public.messages;
drop policy if exists "Direct message access" on public.direct_messages;
drop policy if exists "Direct message write" on public.direct_messages;
drop policy if exists "File access" on public.files;
drop policy if exists "File write" on public.files;

-- Basic user policies
create policy "user_manage_own_profile"
    on public.users
    for all
    using (auth.uid() = id);

-- Workspace policies
create policy "workspace_read"
    on public.workspaces
    for select
    using (
        -- User is the owner
        owner_id = auth.uid()
        or
        -- User is a member (direct check without recursion)
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = id
            and user_id = auth.uid()
        )
    );

create policy "workspace_create"
    on public.workspaces
    for insert
    with check (owner_id = auth.uid());

create policy "workspace_update"
    on public.workspaces
    for update using (owner_id = auth.uid());

create policy "workspace_delete"
    on public.workspaces
    for delete using (owner_id = auth.uid());

-- Workspace membership policies
create policy "workspace_member_read"
    on public.workspace_memberships
    for select
    using (user_id = auth.uid());

create policy "workspace_member_write"
    on public.workspace_memberships
    for insert
    with check (
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

-- Channel policies
create policy "channel_read"
    on public.channels
    for select
    using (
        -- User created the channel
        created_by = auth.uid()
        or
        -- User is a channel member
        exists (
            select 1 from public.channel_memberships
            where channel_id = id
            and user_id = auth.uid()
        )
        or
        -- Channel is public and user is workspace member
        (
            not is_private
            and exists (
                select 1 from public.workspace_memberships
                where workspace_id = channels.workspace_id
                and user_id = auth.uid()
            )
        )
    );

create policy "channel_write"
    on public.channels
    for all
    using (
        -- User created the channel
        created_by = auth.uid()
        or
        -- User is workspace admin/owner
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = channels.workspace_id
            and user_id = auth.uid()
            and role in ('admin', 'owner')
        )
    );

-- Channel membership policies
create policy "channel_member_read"
    on public.channel_memberships
    for select
    using (user_id = auth.uid());

create policy "channel_member_write"
    on public.channel_memberships
    for all
    using (
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = (
                select workspace_id from public.channels
                where id = channel_id
            )
            and user_id = auth.uid()
            and role in ('admin', 'owner')
        )
    );

-- Message policies
create policy "message_read"
    on public.messages
    for select
    using (
        -- User is message author
        user_id = auth.uid()
        or
        -- User is channel member
        exists (
            select 1 from public.channel_memberships
            where channel_id = messages.channel_id
            and user_id = auth.uid()
        )
    );

create policy "message_create"
    on public.messages
    for insert
    with check (
        -- User is channel member
        exists (
            select 1 from public.channel_memberships
            where channel_id = messages.channel_id
            and user_id = auth.uid()
        )
    );

create policy "message_update"
    on public.messages
    for update
    using (user_id = auth.uid());

-- Direct message policies
create policy "dm_read"
    on public.direct_messages
    for select
    using (
        auth.uid() in (sender_id, receiver_id)
    );

create policy "dm_create"
    on public.direct_messages
    for insert
    with check (
        sender_id = auth.uid()
    );

create policy "dm_update"
    on public.direct_messages
    for update
    using (sender_id = auth.uid());

create policy "dm_delete"
    on public.direct_messages
    for delete
    using (sender_id = auth.uid());

-- File policies
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
        -- File is in workspace and user is member
        (
            channel_id is null
            and exists (
                select 1 from public.workspace_memberships
                where workspace_id = files.workspace_id
                and user_id = auth.uid()
            )
        )
    );

create policy "file_create"
    on public.files
    for insert
    with check (user_id = auth.uid()); 