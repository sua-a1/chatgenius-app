-- Drop existing table and function
drop function if exists get_relevant_context;
drop table if exists message_embeddings;

-- Enable the pgvector extension
create extension if not exists vector;

-- Create the message_embeddings table
create table message_embeddings (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid references messages(id) on delete cascade,
  embedding vector(1536),
  metadata jsonb,
  workspace_id uuid,
  channel_id uuid,
  user_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes
create index message_embeddings_embedding_idx on message_embeddings 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create index message_embeddings_message_id_idx on message_embeddings(message_id);
create index message_embeddings_workspace_id_idx on message_embeddings(workspace_id);
create index message_embeddings_channel_id_idx on message_embeddings(channel_id);
create index message_embeddings_user_id_idx on message_embeddings(user_id);

-- Create the similarity search function
create or replace function get_relevant_context(
  query_embedding vector(1536),
  workspace_id_filter uuid,
  user_id_filter uuid,
  similarity_threshold float default 0.8,
  max_results int default 5
) returns table (
  message_id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    m.id as message_id,
    m.content,
    1 - (me.embedding <=> query_embedding) as similarity
  from message_embeddings me
  join messages m on m.id = me.message_id
  where me.workspace_id = workspace_id_filter
    and me.user_id = user_id_filter
    and 1 - (me.embedding <=> query_embedding) > similarity_threshold
  order by me.embedding <=> query_embedding
  limit max_results;
end;
$$; 