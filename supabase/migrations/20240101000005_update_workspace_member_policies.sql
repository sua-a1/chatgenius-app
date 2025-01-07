-- Drop ALL existing policies on workspace_memberships
drop policy if exists "workspace_member_read" on public.workspace_memberships;
drop policy if exists "workspace_member_write" on public.workspace_memberships;
drop policy if exists "workspace_member_insert" on public.workspace_memberships;
drop policy if exists "workspace_member_update" on public.workspace_memberships;
drop policy if exists "workspace_member_delete" on public.workspace_memberships;
drop policy if exists "Read workspace memberships" on public.workspace_memberships;
drop policy if exists "Insert workspace memberships" on public.workspace_memberships;
drop policy if exists "Update workspace memberships" on public.workspace_memberships;
drop policy if exists "Delete workspace memberships" on public.workspace_memberships;
drop policy if exists "Users can view workspace memberships they are part of" on public.workspace_memberships;
drop policy if exists "Workspace membership access" on public.workspace_memberships;

-- Create helper function if it doesn't exist
create or replace function public.is_workspace_owner(workspace_id uuid, user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.workspaces
    where id = workspace_id
    and owner_id = user_id
  );
end;
$$ language plpgsql security definer;

-- Create simple policies using helper function
create policy "workspace_memberships_select"
    on public.workspace_memberships
    for select
    using (
        -- User can read their own memberships
        user_id = auth.uid()
        or
        -- User is workspace owner
        public.is_workspace_owner(workspace_id, auth.uid())
    );

create policy "workspace_memberships_insert"
    on public.workspace_memberships
    for insert
    with check (
        public.is_workspace_owner(workspace_id, auth.uid())
    );

create policy "workspace_memberships_update"
    on public.workspace_memberships
    for update
    using (
        public.is_workspace_owner(workspace_id, auth.uid())
    );

create policy "workspace_memberships_delete"
    on public.workspace_memberships
    for delete
    using (
        public.is_workspace_owner(workspace_id, auth.uid())
    ); 