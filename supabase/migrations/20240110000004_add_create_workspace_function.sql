-- Drop the existing procedure first
drop procedure if exists public.create_workspace_with_membership(text, uuid);

-- Create a function for atomic workspace creation that returns the workspace ID
create or replace function public.create_workspace_with_membership(
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
    -- Create the workspace
    insert into public.workspaces (name, owner_id, created_at, updated_at)
    values (workspace_name, owner_id, now(), now())
    returning id into new_workspace_id;

    -- Create the workspace membership
    insert into public.workspace_memberships (workspace_id, user_id, role, joined_at)
    values (new_workspace_id, owner_id, 'admin', now());

    return new_workspace_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.create_workspace_with_membership(text, uuid) to authenticated; 