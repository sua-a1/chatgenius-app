-- Create a stored procedure for atomic workspace creation
create or replace procedure public.create_workspace_with_membership(
    workspace_name text,
    owner_id uuid
)
language plpgsql
security definer
as $$
declare
    new_workspace_id uuid;
begin
    -- Create the workspace
    insert into public.workspaces (name, owner_id, created_at, updated_at)
    values (workspace_name, owner_id, now(), now())
    returning id into new_workspace_id;

    -- Create the workspace membership
    insert into public.workspace_memberships (workspace_id, user_id, role, joined_at)
    values (new_workspace_id, owner_id, 'admin', now());

    commit;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on procedure public.create_workspace_with_membership(text, uuid) to authenticated; 