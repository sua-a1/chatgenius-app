-- Drop all existing policies
drop policy if exists "workspace_owner_access" on public.workspaces;
drop policy if exists "membership_user_access" on public.workspace_memberships;

-- Disable RLS temporarily
alter table public.workspaces disable row level security;
alter table public.workspace_memberships disable row level security;

-- Drop view if exists
drop view if exists public.accessible_workspaces;

-- Create secure view for accessible workspaces
create or replace view public.accessible_workspaces as
select distinct w.*
from public.workspaces w
where exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
    and (
        -- User is workspace owner
        w.owner_id = u.id
        or
        -- User is workspace member
        exists (
            select 1
            from public.workspace_memberships m
            where m.workspace_id = w.id
            and m.user_id = u.id
        )
    )
);

-- Grant access to the view
grant select on public.accessible_workspaces to authenticated;

-- Re-enable RLS but with simpler policies
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;

-- Simple owner-only policy for workspaces
create policy "workspace_owner_only"
    on public.workspaces
    for all
    using (owner_id = auth.uid());

-- Simple user-only policy for memberships
create policy "membership_user_only"
    on public.workspace_memberships
    for all
    using (user_id = auth.uid()); 