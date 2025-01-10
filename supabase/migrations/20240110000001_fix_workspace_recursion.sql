-- Drop all existing workspace-related policies
drop policy if exists "workspace_select" on public.workspaces;
drop policy if exists "workspace_insert" on public.workspaces;
drop policy if exists "workspace_update" on public.workspaces;
drop policy if exists "workspace_delete" on public.workspaces;
drop policy if exists "workspace_owner_only" on public.workspaces;
drop policy if exists "workspace_read" on public.workspaces;
drop policy if exists "workspace_write" on public.workspaces;

-- Temporarily disable RLS
alter table public.workspaces disable row level security;

-- Create extremely simple policies for workspaces
create policy "workspace_insert_policy"
    on public.workspaces
    for insert
    with check (owner_id = auth.uid());

create policy "workspace_select_policy"
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

create policy "workspace_update_policy"
    on public.workspaces
    for update
    using (owner_id = auth.uid());

create policy "workspace_delete_policy"
    on public.workspaces
    for delete
    using (owner_id = auth.uid());

-- Re-enable RLS
alter table public.workspaces enable row level security; 