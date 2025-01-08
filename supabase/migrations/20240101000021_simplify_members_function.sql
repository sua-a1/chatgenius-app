-- Drop existing function
drop function if exists public.get_workspace_members;

-- Create simpler function to get workspace members
create or replace function public.get_workspace_members(target_workspace_id uuid)
returns table (
    user_id uuid,
    workspace_id uuid,
    role text,
    joined_at timestamptz,
    username text,
    avatar_url text,
    full_name text
)
language sql
security definer
stable
set search_path = public
as $$
    -- Only return members if user is owner or member
    with workspace_access as (
        select true as has_access
        from workspaces w
        where w.id = target_workspace_id
        and w.owner_id = auth.uid()
        union
        select true as has_access
        from workspace_memberships m
        where m.workspace_id = target_workspace_id
        and m.user_id = auth.uid()
        limit 1
    )
    select 
        m.user_id,
        m.workspace_id,
        m.role,
        m.joined_at,
        u.username,
        u.avatar_url,
        u.full_name
    from workspace_memberships m
    join users u on u.id = m.user_id
    where m.workspace_id = target_workspace_id
    and exists (select 1 from workspace_access)
$$; 