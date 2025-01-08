-- Drop all existing policies
drop policy if exists "workspace_read" on public.workspaces;
drop policy if exists "workspace_write" on public.workspaces;
drop policy if exists "workspace_update" on public.workspaces;
drop policy if exists "workspace_delete" on public.workspaces;
drop policy if exists "membership_read" on public.workspace_memberships;
drop policy if exists "membership_write" on public.workspace_memberships;
drop policy if exists "membership_update" on public.workspace_memberships;
drop policy if exists "membership_delete" on public.workspace_memberships;

-- Enable RLS
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;

-- Workspace policies
create policy "workspace_owner_access"
    on public.workspaces
    for all
    using (owner_id = auth.uid());

-- Membership policies
create policy "membership_user_access"
    on public.workspace_memberships
    for all
    using (user_id = auth.uid()); 