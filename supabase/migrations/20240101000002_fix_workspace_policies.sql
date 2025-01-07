-- Drop all existing policies
drop policy if exists "Users can view workspace memberships they are part of" on public.workspace_memberships;
drop policy if exists "Workspace membership access" on public.workspace_memberships;

-- Add separate read policy for workspace memberships
create policy "Read workspace memberships"
    on public.workspace_memberships
    for select
    using (
        -- User can read their own memberships
        user_id = auth.uid()
    );

-- Add separate insert policy for workspace memberships
create policy "Insert workspace memberships"
    on public.workspace_memberships
    for insert
    with check (
        -- Only workspace owners can add members
        exists (
            select 1
            from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

-- Add separate update policy for workspace memberships
create policy "Update workspace memberships"
    on public.workspace_memberships
    for update
    using (
        -- Only workspace owners can update members
        exists (
            select 1
            from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

-- Add separate delete policy for workspace memberships
create policy "Delete workspace memberships"
    on public.workspace_memberships
    for delete
    using (
        -- Only workspace owners can remove members
        exists (
            select 1
            from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    ); 