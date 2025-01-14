-- Drop existing function first
drop function if exists search_messages(vector, jsonb, int);

-- Create a function to search messages using vector similarity
create or replace function search_messages(
  query_embedding vector(1536),
  filter jsonb default '{}',
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    m.id,
    m.content,
    jsonb_build_object(
      'workspace_id', me.workspace_id,
      'channel_id', me.channel_id,
      'channel_name', c.name,
      'created_at', m.created_at,
      'user_id', me.user_id,
      'username', coalesce(u.username, 'unknown'),
      'full_name', coalesce(u.full_name, 'Unknown User')
    ) as metadata,
    1 - (me.embedding <=> query_embedding) as similarity
  from
    message_embeddings me
    inner join messages m on m.id = me.message_id
    inner join channels c on c.id = me.channel_id
    inner join users u on u.id = me.user_id
  where
    case
      when filter->>'workspace_id' is not null then
        me.workspace_id = (filter->>'workspace_id')::uuid
      else true
    end
    and
    case
      when filter->>'channel_name' is not null then
        lower(c.name) = lower(filter->>'channel_name')
      else true
    end
    and
    case
      when filter->>'user_id' is not null then
        me.user_id = (filter->>'user_id')::uuid
      else true
    end
  order by
    me.embedding <=> query_embedding
  limit match_count;
end;
$$; 