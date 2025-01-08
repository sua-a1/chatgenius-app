-- Function to get workspace members with user details
create or replace function public.get_workspace_members_with_details(target_workspace_id uuid)
returns table (
    user_id uuid,
    role text,
    username text,
    email text,
    avatar_url text,
    status text,
    created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
    select 
        u.id as user_id,
        m.role,
        u.username,
        u.email,
        u.avatar_url,
        u.status,
        u.created_at
    from workspace_memberships m
    join users u on u.id = m.user_id
    where m.workspace_id = target_workspace_id
    and exists (
        select 1 from workspaces w
        where w.id = target_workspace_id
        and (
            w.owner_id = auth.uid()
            or exists (
                select 1 from workspace_memberships m2
                where m2.workspace_id = w.id
                and m2.user_id = auth.uid()
                and m2.role in ('admin', 'owner')
            )
        )
    );
$$;

-- Function to add workspace member
create or replace function public.add_workspace_member(
    target_workspace_id uuid,
    target_email text,
    target_role text default 'member'
)
returns uuid
language plpgsql
security definer
as $$
declare
    target_user_id uuid;
begin
    -- Check if caller is admin/owner
    if not exists (
        select 1 from workspaces w
        where w.id = target_workspace_id
        and (
            w.owner_id = auth.uid()
            or exists (
                select 1 from workspace_memberships m
                where m.workspace_id = w.id
                and m.user_id = auth.uid()
                and m.role in ('admin', 'owner')
            )
        )
    ) then
        raise exception 'Access denied';
    end if;

    -- Get user ID from email
    select id into target_user_id
    from users
    where email = lower(trim(target_email));

    if target_user_id is null then
        raise exception 'User not found';
    end if;

    -- Check if already a member
    if exists (
        select 1 from workspace_memberships
        where workspace_id = target_workspace_id
        and user_id = target_user_id
    ) then
        raise exception 'User is already a member';
    end if;

    -- Add member
    insert into workspace_memberships (workspace_id, user_id, role)
    values (target_workspace_id, target_user_id, target_role)
    returning user_id into target_user_id;

    return target_user_id;
end;
$$;

-- Function to update workspace member role
create or replace function public.update_workspace_member_role(
    target_workspace_id uuid,
    target_user_id uuid,
    new_role text
)
returns void
language plpgsql
security definer
as $$
begin
    -- Check if caller is admin/owner
    if not exists (
        select 1 from workspaces w
        where w.id = target_workspace_id
        and (
            w.owner_id = auth.uid()
            or exists (
                select 1 from workspace_memberships m
                where m.workspace_id = w.id
                and m.user_id = auth.uid()
                and m.role in ('admin', 'owner')
            )
        )
    ) then
        raise exception 'Access denied';
    end if;

    -- Update role
    update workspace_memberships
    set role = new_role
    where workspace_id = target_workspace_id
    and user_id = target_user_id;

    if not found then
        raise exception 'Member not found';
    end if;
end;
$$;

-- Function to remove workspace member
create or replace function public.remove_workspace_member(
    target_workspace_id uuid,
    target_user_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
    -- Check if caller is admin/owner
    if not exists (
        select 1 from workspaces w
        where w.id = target_workspace_id
        and (
            w.owner_id = auth.uid()
            or exists (
                select 1 from workspace_memberships m
                where m.workspace_id = w.id
                and m.user_id = auth.uid()
                and m.role in ('admin', 'owner')
            )
        )
    ) then
        raise exception 'Access denied';
    end if;

    -- Remove member
    delete from workspace_memberships
    where workspace_id = target_workspace_id
    and user_id = target_user_id;

    if not found then
        raise exception 'Member not found';
    end if;
end;
$$;

-- Grant execute permissions
grant execute on function public.get_workspace_members_with_details(uuid) to authenticated;
grant execute on function public.add_workspace_member(uuid, text, text) to authenticated;
grant execute on function public.update_workspace_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated; 