-- Drop all existing policies
drop policy if exists "workspace_read_all" on public.workspaces;
drop policy if exists "workspace_owner_modify" on public.workspaces;
drop policy if exists "workspace_member_read_own" on public.workspace_memberships;
drop policy if exists "workspace_owner_insert_members" on public.workspace_memberships;
drop policy if exists "workspace_owner_update_members" on public.workspace_memberships;
drop policy if exists "workspace_owner_delete_members" on public.workspace_memberships;

-- Make sure RLS is enabled
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;

-- Create simple workspace policies
create policy "workspace_read"
    on public.workspaces
    for select
    using (true);  -- Allow reading all workspaces

create policy "workspace_write"
    on public.workspaces
    for insert
    with check (owner_id = auth.uid());

create policy "workspace_update"
    on public.workspaces
    for update
    using (owner_id = auth.uid());

create policy "workspace_delete"
    on public.workspaces
    for delete
    using (owner_id = auth.uid());

-- Create simple membership policies
create policy "membership_read"
    on public.workspace_memberships
    for select
    using (user_id = auth.uid());  -- Only see own memberships

create policy "membership_write"
    on public.workspace_memberships
    for insert
    with check (true);  -- Let application logic handle this

create policy "membership_update"
    on public.workspace_memberships
    for update
    using (user_id = auth.uid());  -- Can only update own memberships

create policy "membership_delete"
    on public.workspace_memberships
    for delete
    using (user_id = auth.uid());  -- Can only delete own memberships 