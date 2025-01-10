-- Drop all existing workspace-related policies
drop policy if exists "workspace_owner_access" on public.workspaces;
drop policy if exists "workspace_read" on public.workspaces;
drop policy if exists "workspace_write" on public.workspaces;
drop policy if exists "workspace_update" on public.workspaces;
drop policy if exists "workspace_delete" on public.workspaces;
drop policy if exists "workspace_owner_only" on public.workspaces;
drop policy if exists "Users can view workspaces they are members of" on public.workspaces;

-- Drop the accessible_workspaces view if it exists
drop view if exists public.accessible_workspaces;

-- Create a new view for accessible workspaces without recursion
create or replace view public.accessible_workspaces as
select distinct w.*
from public.workspaces w
left join public.workspace_memberships m on m.workspace_id = w.id
where w.owner_id = auth.uid() or m.user_id = auth.uid();

-- Grant access to the view
grant select on public.accessible_workspaces to authenticated;

-- Create simple non-recursive policies for workspaces
create policy "workspace_select"
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

create policy "workspace_insert"
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

-- Update the workspace memberships policies to be non-recursive
drop policy if exists "membership_user_access" on public.workspace_memberships;
drop policy if exists "workspace_memberships_select" on public.workspace_memberships;
drop policy if exists "workspace_memberships_insert" on public.workspace_memberships;
drop policy if exists "workspace_memberships_delete" on public.workspace_memberships;

create policy "membership_select"
    on public.workspace_memberships
    for select
    using (user_id = auth.uid());

create policy "membership_insert"
    on public.workspace_memberships
    for insert
    with check (
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "membership_update"
    on public.workspace_memberships
    for update
    using (
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "membership_delete"
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