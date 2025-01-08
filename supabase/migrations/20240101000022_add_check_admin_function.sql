-- Create function to check admin status
create or replace function public.check_workspace_admin_status(target_workspace_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
    select m.role
    from workspace_memberships m
    where m.workspace_id = target_workspace_id
    and m.user_id = auth.uid()
    union all
    select 'owner'::text
    from workspaces w
    where w.id = target_workspace_id
    and w.owner_id = auth.uid()
    limit 1;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.check_workspace_admin_status(uuid) to authenticated; 