-- Drop old grants if they exist
drop function if exists search_messages(vector, uuid, jsonb, int);

-- Grant execute permission to authenticated users for new signature
grant execute on function search_messages(vector, jsonb, int) to authenticated;

-- Revoke execute from public for new signature
revoke execute on function search_messages(vector, jsonb, int) from public; 