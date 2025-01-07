-- Drop existing policies first
drop policy if exists "channel_read" on public.channels;
drop policy if exists "channel_write" on public.channels;
drop policy if exists "channel_member_read" on public.channel_memberships;
drop policy if exists "channel_member_write" on public.channel_memberships;

-- Create helper functions
create or replace function public.is_workspace_member(workspace_id uuid, user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.workspace_memberships
    where workspace_id = $1
    and user_id = $2
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_workspace_admin(workspace_id uuid, user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.workspace_memberships
    where workspace_id = $1
    and user_id = $2
    and role in ('admin', 'owner')
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_channel_member(channel_id uuid, user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.channel_memberships
    where channel_id = $1
    and user_id = $2
  );
end;
$$ language plpgsql security definer;

-- Create simplified policies using helper functions
create policy "channels_select_policy"
    on public.channels
    for select
    using (
        created_by = auth.uid()
        or
        public.is_channel_member(id, auth.uid())
        or
        (
            not is_private 
            and public.is_workspace_member(workspace_id, auth.uid())
        )
    );

create policy "channels_insert_policy"
    on public.channels
    for insert
    with check (
        public.is_workspace_member(workspace_id, auth.uid())
    );

create policy "channels_update_policy"
    on public.channels
    for update
    using (
        created_by = auth.uid()
        or
        public.is_workspace_admin(workspace_id, auth.uid())
    );

create policy "channels_delete_policy"
    on public.channels
    for delete
    using (
        created_by = auth.uid()
        or
        public.is_workspace_admin(workspace_id, auth.uid())
    );

create policy "channel_memberships_select_policy"
    on public.channel_memberships
    for select
    using (
        user_id = auth.uid()
        or
        public.is_channel_member(channel_id, auth.uid())
    );

create policy "channel_memberships_insert_policy"
    on public.channel_memberships
    for insert
    with check (
        exists (
            select 1 from public.channels c
            where c.id = channel_id
            and public.is_workspace_admin(c.workspace_id, auth.uid())
        )
    );

create policy "channel_memberships_delete_policy"
    on public.channel_memberships
    for delete
    using (
        exists (
            select 1 from public.channels c
            where c.id = channel_id
            and public.is_workspace_admin(c.workspace_id, auth.uid())
        )
    ); 