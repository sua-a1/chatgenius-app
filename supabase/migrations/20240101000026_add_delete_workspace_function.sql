-- Function to delete a workspace with role checking
create or replace function public.delete_workspace(
    workspace_id_param uuid
)
returns void
language plpgsql
security definer
as $$
declare
    user_role text;
begin
    -- Check if the user has admin role in the workspace
    select role into user_role
    from public.workspace_memberships
    where workspace_id = workspace_id_param
    and user_id = auth.uid()
    and role = 'admin';

    -- If user is not an admin, raise an error
    if user_role is null then
        raise exception 'Access denied. Only workspace admins can delete workspaces.';
    end if;

    -- Delete all related data in the correct order to avoid foreign key conflicts
    -- Delete channel memberships first
    delete from public.channel_memberships
    where channel_id in (
        select id from public.channels
        where workspace_id = workspace_id_param
    );

    -- Delete messages in channels
    delete from public.messages
    where channel_id in (
        select id from public.channels
        where workspace_id = workspace_id_param
    );

    -- Delete channels
    delete from public.channels
    where workspace_id = workspace_id_param;

    -- Delete direct messages
    delete from public.direct_messages
    where workspace_id = workspace_id_param;

    -- Delete workspace memberships
    delete from public.workspace_memberships
    where workspace_id = workspace_id_param;

    -- Finally delete the workspace
    delete from public.workspaces
    where id = workspace_id_param;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.delete_workspace(uuid) to authenticated; 