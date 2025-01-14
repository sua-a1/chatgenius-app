-- Drop existing function if it exists
drop function if exists get_messages_without_embeddings(int);

-- Create function to get messages without embeddings
create or replace function get_messages_without_embeddings(batch_limit int)
returns table (
  id uuid,
  content text,
  channel_id uuid,
  user_id uuid,
  created_at timestamptz,
  workspace_id uuid
) language sql as $$
  select 
    m.id,
    m.content,
    m.channel_id,
    m.user_id,
    m.created_at,
    c.workspace_id
  from messages m
  inner join channels c on c.id = m.channel_id
  where not exists (
    select 1 
    from message_embeddings me 
    where me.message_id = m.id
  )
  order by m.created_at asc
  limit batch_limit;
$$; 