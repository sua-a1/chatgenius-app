-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table for storing message embeddings
create table if not exists message_embeddings (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid references messages(id) on delete cascade,
  embedding vector(1536), -- OpenAI's text-embedding-ada-002 uses 1536 dimensions
  metadata jsonb,
  workspace_id uuid not null,
  channel_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create an index for the vector column using cosine distance
create index if not exists message_embeddings_embedding_idx on message_embeddings 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create an index for message_id lookups
create index if not exists message_embeddings_message_id_idx on message_embeddings(message_id);

-- Create indexes for common filters
create index if not exists message_embeddings_workspace_id_idx on message_embeddings(workspace_id);
create index if not exists message_embeddings_channel_id_idx on message_embeddings(channel_id);
create index if not exists message_embeddings_user_id_idx on message_embeddings(user_id);

-- Function to get relevant context based on similarity search
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

-- Set up RLS policies
alter table public.message_embeddings enable row level security;

-- Read policy: users can only read embeddings from workspaces they are members of
create policy "Users can read embeddings from their workspaces"
    on public.message_embeddings
    for select
    using (
        workspace_id in (
            select workspace_id 
            from public.workspace_members 
            where user_id = auth.uid()
        )
    );

-- Write policy: only the system can insert/update embeddings
create policy "System can manage embeddings"
    on public.message_embeddings
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- Grant necessary permissions
grant select on public.message_embeddings to authenticated;
grant all on public.message_embeddings to service_role; 