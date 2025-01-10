-- Function to get user information with presence status
create or replace function public.get_user_info_with_presence(target_user_id uuid)
returns table (
    id uuid,
    username text,
    full_name text,
    email text,
    avatar_url text,
    created_at timestamptz,
    status text,
    last_seen timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
    select 
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.avatar_url,
        u.created_at,
        p.status,
        p.last_seen
    from users u
    left join user_presence p on p.user_id = u.id
    where u.id = target_user_id
    and exists (
        -- Only return info if the requesting user is in the same workspace
        select 1 
        from workspace_memberships m1
        join workspace_memberships m2 on m2.workspace_id = m1.workspace_id
        where m1.user_id = auth.uid()
        and m2.user_id = target_user_id
    );
$$;

-- Grant execute permission to authenticated users
grant execute on function public.get_user_info_with_presence(uuid) to authenticated; 