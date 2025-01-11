-- Drop existing policies
drop policy if exists "membership_access" on public.workspace_memberships;
drop policy if exists "membership_select" on public.workspace_memberships;
drop policy if exists "membership_insert" on public.workspace_memberships;
drop policy if exists "membership_update" on public.workspace_memberships;
drop policy if exists "membership_delete" on public.workspace_memberships;

-- Create new non-recursive policies
create policy "membership_select"
    on public.workspace_memberships
    for select
    using (
        user_id = auth.uid() or
        exists (
            select 1 from public.workspaces w
            where w.id = workspace_id
            and w.owner_id = auth.uid()
        )
    );

create policy "membership_insert"
    on public.workspace_memberships
    for insert
    with check (
        exists (
            select 1 from public.workspaces w
            where w.id = workspace_id
            and w.owner_id = auth.uid()
        )
    );

create policy "membership_update"
    on public.workspace_memberships
    for update
    using (
        exists (
            select 1 from public.workspaces w
            where w.id = workspace_id
            and w.owner_id = auth.uid()
        )
    );

create policy "membership_delete"
    on public.workspace_memberships
    for delete
    using (
        user_id = auth.uid() or
        exists (
            select 1 from public.workspaces w
            where w.id = workspace_id
            and w.owner_id = auth.uid()
        )
    ); 