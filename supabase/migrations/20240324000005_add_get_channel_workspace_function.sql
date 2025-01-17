-- Create a function to get a channel's workspace_id
create or replace function get_channel_workspace(channel_id_param uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'workspace_id', c.workspace_id,
    'channel_id', c.id
  )
  into result
  from channels c
  where c.id = channel_id_param;

  return result;
end;
$$; 