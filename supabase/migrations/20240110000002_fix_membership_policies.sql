-- Drop all existing membership policies
drop policy if exists "workspace_memberships_select" on public.workspace_memberships;
drop policy if exists "workspace_memberships_insert" on public.workspace_memberships;
drop policy if exists "workspace_memberships_update" on public.workspace_memberships;
drop policy if exists "workspace_memberships_delete" on public.workspace_memberships;
drop policy if exists "membership_user_only" on public.workspace_memberships;

-- Temporarily disable RLS
alter table public.workspace_memberships disable row level security;

-- Create simple policies for workspace memberships
create policy "membership_insert_policy"
    on public.workspace_memberships
    for insert
    with check (
        -- Can only add members to workspaces you own
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "membership_select_policy"
    on public.workspace_memberships
    for select
    using (
        -- Can read own memberships
        user_id = auth.uid()
        or
        -- Can read memberships of workspaces you own
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "membership_update_policy"
    on public.workspace_memberships
    for update
    using (
        -- Can only update memberships in workspaces you own
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "membership_delete_policy"
    on public.workspace_memberships
    for delete
    using (
        -- Can delete own membership or any membership in workspaces you own
        user_id = auth.uid()
        or
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

-- Re-enable RLS
alter table public.workspace_memberships enable row level security; 