-- Drop view if exists
drop view if exists public.workspace_members;

-- Create secure view for workspace members
create or replace view public.workspace_members as
select 
    m.workspace_id,
    m.user_id,
    m.role,
    m.joined_at,
    u.username,
    u.avatar_url
from public.workspace_memberships m
join public.users u on u.id = m.user_id
where exists (
    select 1
    from public.workspaces w
    where w.id = m.workspace_id
    and (
        -- User is workspace owner
        w.owner_id = auth.uid()
        or
        -- User is workspace member
        exists (
            select 1
            from public.workspace_memberships my_m
            where my_m.workspace_id = w.id
            and my_m.user_id = auth.uid()
        )
    )
);

-- Grant access to the view
grant select on public.workspace_members to authenticated;

-- Update workspace memberships policy to be simpler
drop policy if exists "membership_user_only" on public.workspace_memberships;

create policy "membership_access"
    on public.workspace_memberships
    for all
    using (
        -- Can access own memberships
        user_id = auth.uid()
        or
        -- Can access memberships of owned workspaces
        workspace_id in (
            select id from public.workspaces
            where owner_id = auth.uid()
        )
    ); 