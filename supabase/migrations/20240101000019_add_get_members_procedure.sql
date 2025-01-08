-- Drop existing membership policies
drop policy if exists "workspace_memberships_select" on public.workspace_memberships;
drop policy if exists "workspace_memberships_insert" on public.workspace_memberships;
drop policy if exists "workspace_memberships_update" on public.workspace_memberships;
drop policy if exists "workspace_memberships_delete" on public.workspace_memberships;
drop policy if exists "membership_access" on public.workspace_memberships;

-- Create function to get workspace members
create or replace function public.get_workspace_members(workspace_id uuid)
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
        where w.id = workspace_id
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
    where m.workspace_id = $1;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.get_workspace_members(uuid) to authenticated;

-- Create minimal policies for workspace memberships
create policy "workspace_memberships_select"
    on public.workspace_memberships
    for select
    using (user_id = auth.uid());

create policy "workspace_memberships_insert"
    on public.workspace_memberships
    for insert
    with check (
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    );

create policy "workspace_memberships_delete"
    on public.workspace_memberships
    for delete
    using (
        exists (
            select 1 from public.workspaces
            where id = workspace_id
            and owner_id = auth.uid()
        )
    ); 