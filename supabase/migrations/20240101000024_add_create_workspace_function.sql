-- Create function to create workspace and assign admin role atomically
create or replace function public.create_workspace(
    workspace_name text,
    owner_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
    new_workspace_id uuid;
begin
    -- Verify the owner_id exists in users table
    if not exists (select 1 from public.users where id = owner_id) then
        raise exception 'User does not exist';
    end if;

    -- Create the workspace
    insert into public.workspaces (name, owner_id)
    values (workspace_name, owner_id)
    returning id into new_workspace_id;

    -- Create the workspace membership with admin role
    insert into public.workspace_memberships (workspace_id, user_id, role)
    values (new_workspace_id, owner_id, 'admin');

    return new_workspace_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.create_workspace(text, uuid) to authenticated; 