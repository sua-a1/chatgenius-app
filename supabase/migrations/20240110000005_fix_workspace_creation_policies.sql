-- Drop ALL existing workspace policies
drop policy if exists "workspace_select" on public.workspaces;
drop policy if exists "workspace_insert" on public.workspaces;
drop policy if exists "workspace_update" on public.workspaces;
drop policy if exists "workspace_delete" on public.workspaces;
drop policy if exists "workspace_select_policy" on public.workspaces;
drop policy if exists "workspace_insert_policy" on public.workspaces;
drop policy if exists "workspace_update_policy" on public.workspaces;
drop policy if exists "workspace_delete_policy" on public.workspaces;
drop policy if exists "workspace_owner_access" on public.workspaces;
drop policy if exists "workspace_read" on public.workspaces;
drop policy if exists "workspace_write" on public.workspaces;

-- Create simplified non-recursive policies with unique names
create policy "workspace_select_v2"
    on public.workspaces
    for select
    using (
        owner_id = auth.uid() or
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = id
            and user_id = auth.uid()
        )
    );

create policy "workspace_insert_v2"
    on public.workspaces
    for insert
    with check (owner_id = auth.uid());

create policy "workspace_update_v2"
    on public.workspaces
    for update
    using (owner_id = auth.uid());

create policy "workspace_delete_v2"
    on public.workspaces
    for delete
    using (owner_id = auth.uid());

-- Drop ALL existing workspace membership policies
drop policy if exists "membership_select" on public.workspace_memberships;
drop policy if exists "membership_insert" on public.workspace_memberships;
drop policy if exists "membership_update" on public.workspace_memberships;
drop policy if exists "membership_delete" on public.workspace_memberships;
drop policy if exists "membership_select_policy" on public.workspace_memberships;
drop policy if exists "membership_insert_policy" on public.workspace_memberships;
drop policy if exists "membership_update_policy" on public.workspace_memberships;
drop policy if exists "membership_delete_policy" on public.workspace_memberships;
drop policy if exists "workspace_member_read" on public.workspace_memberships;
drop policy if exists "workspace_member_write" on public.workspace_memberships;

-- Create simplified membership policies with unique names
create policy "membership_select_v2"
    on public.workspace_memberships
    for select
    using (user_id = auth.uid());

create policy "membership_insert_v2"
    on public.workspace_memberships
    for insert
    with check (
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "membership_update_v2"
    on public.workspace_memberships
    for update
    using (
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "membership_delete_v2"
    on public.workspace_memberships
    for delete
    using (
        user_id = auth.uid() or
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    ); 