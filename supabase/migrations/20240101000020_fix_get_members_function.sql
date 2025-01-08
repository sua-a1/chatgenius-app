-- Drop existing function
drop function if exists public.get_workspace_members;

-- Create fixed function to get workspace members
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
language plpgsql
security definer
stable
as $$
begin
    -- Check if user can access this workspace
    if not exists (
        select 1 from public.workspaces w
        where w.id = target_workspace_id
        and (
            w.owner_id = auth.uid()
            or exists (
                select 1 from public.workspace_memberships m
                where m.workspace_id = w.id
                and m.user_id = auth.uid()
            )
        )
    ) then
        raise exception 'Access denied';
    end if;

    -- Return workspace members with user details
    return query
    select 
        m.user_id,
        m.workspace_id,
        m.role,
        m.joined_at,
        u.username,
        u.avatar_url,
        u.full_name
    from public.workspace_memberships m
    join public.users u on u.id = m.user_id
    where m.workspace_id = target_workspace_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.get_workspace_members(uuid) to authenticated; 