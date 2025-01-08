-- Drop existing membership policy
drop policy if exists "membership_access" on public.workspace_memberships;

-- Create simpler policies for workspace memberships
create policy "workspace_memberships_select"
    on public.workspace_memberships
    for select
    using (
        -- Can read own memberships
        user_id = auth.uid()
        or
        -- Can read memberships of workspaces you own
        workspace_id in (
            select id from public.workspaces
            where owner_id = auth.uid()
        )
    );

create policy "workspace_memberships_insert"
    on public.workspace_memberships
    for insert
    with check (
        -- Can only add members to workspaces you own
        workspace_id in (
            select id from public.workspaces
            where owner_id = auth.uid()
        )
    );

create policy "workspace_memberships_update"
    on public.workspace_memberships
    for update
    using (
        -- Can only update memberships in workspaces you own
        workspace_id in (
            select id from public.workspaces
            where owner_id = auth.uid()
        )
    );

create policy "workspace_memberships_delete"
    on public.workspace_memberships
    for delete
    using (
        -- Can only delete memberships in workspaces you own
        workspace_id in (
            select id from public.workspaces
            where owner_id = auth.uid()
        )
    ); 