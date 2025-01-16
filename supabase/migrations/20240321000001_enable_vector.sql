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

-- Set up custom settings
create or replace function set_app_settings()
returns void
language plpgsql
as $$
begin
  -- Set the edge function URL
  perform set_config(
    'app.settings.edge_function_url',
    'https://clohwjjmidcucvvxgxaf.supabase.co/functions/v1',
    false
  );
  
  -- Set the service role key
  perform set_config(
    'app.settings.service_role_key',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsb2h3amptaWRjdWN2dnhneGFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjIxNzQzNywiZXhwIjoyMDUxNzkzNDM3fQ.w52P0_40AJX1sOnZhlqIXCnVRPZXY8adlENFn2YtpCE',
    false
  );
end;
$$;

-- Create a function to trigger embedding generation
create or replace function trigger_generate_embedding()
returns trigger
language plpgsql
as $$
declare
  response_status int;
  response_body text;
begin
  -- Ensure settings are set
  perform set_app_settings();

  -- Call the Edge Function to generate embeddings
  select
    status, content
  into
    response_status, response_body
  from
    net.http_post(
      url := current_setting('app.settings.edge_function_url') || '/generate-embeddings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'message_id', NEW.id,
        'content', NEW.content,
        'workspace_id', NEW.workspace_id,
        'channel_id', NEW.channel_id,
        'user_id', NEW.user_id
      )
    );

  -- Log the response for debugging
  raise notice 'Embedding generation response: status %, body %', response_status, response_body;

  -- Return the original message
  return NEW;
exception
  when others then
    -- Log any errors but don't block message creation
    raise notice 'Error generating embedding: %', SQLERRM;
    return NEW;
end;
$$;

-- Create a trigger to automatically generate embeddings for new messages
drop trigger if exists generate_embedding_trigger on messages;
create trigger generate_embedding_trigger
  after insert on messages
  for each row
  execute function trigger_generate_embedding();

-- Drop existing functions first
drop function if exists get_relevant_context(vector, uuid, float, int);
drop function if exists get_relevant_context(vector, uuid, uuid, float, int);

-- Function to get relevant context based on similarity search
create or replace function get_relevant_context(
  query_embedding vector(1536),
  workspace_id_filter uuid,
  similarity_threshold float default 0.8,
  max_results int default 5
) returns table (
  message_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    m.id as message_id,
    m.content,
    jsonb_build_object(
      'workspace_id', me.workspace_id,
      'channel_id', me.channel_id,
      'user_id', me.user_id,
      'created_at', m.created_at
    ) as metadata,
    1 - (me.embedding <=> query_embedding) as similarity
  from message_embeddings me
  join messages m on m.id = me.message_id
  where me.workspace_id = workspace_id_filter
    and 1 - (me.embedding <=> query_embedding) > similarity_threshold
  order by me.embedding <=> query_embedding
  limit max_results;
end;
$$;

-- Set up RLS policies
alter table public.message_embeddings enable row level security;

-- Drop existing policies
drop policy if exists "Users can read embeddings from their workspaces" on public.message_embeddings;
drop policy if exists "System can manage embeddings" on public.message_embeddings;

-- Read policy: users can read embeddings from workspaces they are members of
create policy "Users can read embeddings from their workspaces"
    on public.message_embeddings
    for select
    using (
        exists (
            select 1 
            from workspace_memberships wm
            where wm.workspace_id = message_embeddings.workspace_id
            and wm.user_id = auth.uid()
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