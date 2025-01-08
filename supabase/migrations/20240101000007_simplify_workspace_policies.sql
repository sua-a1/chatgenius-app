-- First drop all existing policies
drop policy if exists "workspace_select" on public.workspaces;
drop policy if exists "workspace_modify" on public.workspaces;
drop policy if exists "workspace_membership_select" on public.workspace_memberships;
drop policy if exists "workspace_membership_insert" on public.workspace_memberships;
drop policy if exists "workspace_membership_update" on public.workspace_memberships;
drop policy if exists "workspace_membership_delete" on public.workspace_memberships;
drop policy if exists "Users can view workspace memberships they are part of" on public.workspace_memberships;
drop policy if exists "Workspace membership access" on public.workspace_memberships;
drop policy if exists "Workspace read access" on public.workspaces;
drop policy if exists "Workspace write access" on public.workspaces;
drop policy if exists "Read workspace memberships" on public.workspace_memberships;
drop policy if exists "Insert workspace memberships" on public.workspace_memberships;
drop policy if exists "Update workspace memberships" on public.workspace_memberships;
drop policy if exists "Delete workspace memberships" on public.workspace_memberships;
drop policy if exists "workspace_owner_all" on public.workspaces;
drop policy if exists "workspace_member_read" on public.workspaces;
drop policy if exists "workspace_membership_owner_all" on public.workspace_memberships;
drop policy if exists "workspace_membership_self_read" on public.workspace_memberships;

-- Make sure RLS is enabled
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;

-- Create new simplified policies with unique names
create policy "workspace_read_all"
    on public.workspaces
    for select
    using (true);  -- Allow reading all workspaces, access control via joins

create policy "workspace_owner_modify"
    on public.workspaces
    for all
    using (owner_id = auth.uid());

create policy "workspace_member_read_own"
    on public.workspace_memberships
    for select
    using (user_id = auth.uid());  -- Only see own memberships

create policy "workspace_owner_insert_members"
    on public.workspace_memberships
    for insert
    with check (
        exists (
            select 1 from workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "workspace_owner_update_members"
    on public.workspace_memberships
    for update
    using (
        exists (
            select 1 from workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "workspace_owner_delete_members"
    on public.workspace_memberships
    for delete
    using (
        exists (
            select 1 from workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    ); 