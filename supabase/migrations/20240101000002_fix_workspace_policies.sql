-- Drop existing workspace and membership policies
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

-- Enable RLS
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;

-- Simple workspace policies
create policy "workspace_select"
    on public.workspaces
    for select
    using (true);  -- Allow reading all workspaces, access control via joins

create policy "workspace_modify"
    on public.workspaces
    for all
    using (owner_id = auth.uid());

-- Simple workspace membership policies
create policy "workspace_membership_select"
    on public.workspace_memberships
    for select
    using (user_id = auth.uid());  -- Only see own memberships

create policy "workspace_membership_insert"
    on public.workspace_memberships
    for insert
    with check (
        exists (
            select 1 from workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "workspace_membership_update"
    on public.workspace_memberships
    for update
    using (
        exists (
            select 1 from workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "workspace_membership_delete"
    on public.workspace_memberships
    for delete
    using (
        exists (
            select 1 from workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    ); 