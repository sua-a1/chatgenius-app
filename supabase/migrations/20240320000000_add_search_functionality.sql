-- Enable vector extension
create extension if not exists vector;

-- Add embedding columns to searchable tables
alter table public.messages add column if not exists content_embedding vector(1536);
alter table public.users add column if not exists name_embedding vector(1536);
alter table public.channels add column if not exists search_embedding vector(1536);

-- Create function to generate embeddings via OpenAI
create or replace function public.generate_embeddings(input text)
returns vector
language plpgsql
security definer
as $$
declare
  embedding vector(1536);
begin
  -- This function will be implemented in the application layer
  -- since it requires OpenAI API access
  return embedding;
end;
$$;

-- Drop existing search function
drop function if exists public.search_workspace(uuid, text, float, int);

-- Create unified search function
create or replace function public.search_workspace(
  workspace_id uuid,
  query text,
  similarity_threshold float default 0.5,
  match_count int default 5
)
returns table (
  type text,
  id uuid,
  content text,
  similarity float,
  channel_id uuid,
  channel_name text
)
language plpgsql
security definer
as $$
begin
  return query
  (
    -- Search messages
    select 
      'message' as type,
      m.id,
      m.content as content,
      greatest(
        1 - (m.content_embedding <=> generate_embeddings(query)),
        case when m.content ilike '%' || query || '%' then 0.6 else 0 end
      ) as similarity,
      m.channel_id,
      c.name as channel_name
    from public.messages m
    join public.channels c on c.id = m.channel_id
    where c.workspace_id = search_workspace.workspace_id
    and m.content is not null 
    and m.content != ''
    and (
      m.content_embedding is not null
      and 1 - (m.content_embedding <=> generate_embeddings(query)) > similarity_threshold
      or
      m.content ilike '%' || query || '%'
    )
    
    union all
    
    -- Search users
    select 
      'user' as type,
      u.id,
      u.username as content,
      greatest(
        1 - (u.name_embedding <=> generate_embeddings(query)),
        case when u.username ilike '%' || query || '%' then 0.6 else 0 end
      ) as similarity,
      null::uuid,
      null::text
    from public.users u
    join public.workspace_memberships wm on wm.user_id = u.id
    where wm.workspace_id = search_workspace.workspace_id
    and u.username is not null 
    and u.username != ''
    and (
      u.name_embedding is not null
      and 1 - (u.name_embedding <=> generate_embeddings(query)) > similarity_threshold
      or
      u.username ilike '%' || query || '%'
    )
    
    union all
    
    -- Search channels
    select 
      'channel' as type,
      c.id,
      c.name as content,
      greatest(
        1 - (c.search_embedding <=> generate_embeddings(query)),
        case when c.name ilike '%' || query || '%' then 0.6 else 0 end
      ) as similarity,
      null::uuid,
      null::text
    from public.channels c
    where c.workspace_id = search_workspace.workspace_id
    and c.name is not null 
    and c.name != ''
    and (
      c.search_embedding is not null
      and 1 - (c.search_embedding <=> generate_embeddings(query)) > similarity_threshold
      or
      c.name ilike '%' || query || '%'
    )
  )
  order by similarity desc
  limit match_count;
end;
$$;

-- Create trigger functions to update embeddings
create or replace function public.update_message_embedding()
returns trigger
language plpgsql
security definer
as $$
begin
  new.content_embedding = generate_embeddings(new.content);
  return new;
end;
$$;

create or replace function public.update_user_embedding()
returns trigger
language plpgsql
security definer
as $$
begin
  new.name_embedding = generate_embeddings(concat_ws(' ', new.username, new.full_name));
  return new;
end;
$$;

create or replace function public.update_channel_embedding()
returns trigger
language plpgsql
security definer
as $$
begin
  new.search_embedding = generate_embeddings(concat_ws(' ', new.name, new.topic));
  return new;
end;
$$;

-- Drop existing triggers if they exist
drop trigger if exists message_embedding_update on public.messages;
drop trigger if exists user_embedding_update on public.users;
drop trigger if exists channel_embedding_update on public.channels;

-- Create triggers
create trigger message_embedding_update
  before insert or update of content
  on public.messages
  for each row
  execute function public.update_message_embedding();

create trigger user_embedding_update
  before insert or update of username, full_name
  on public.users
  for each row
  execute function public.update_user_embedding();

create trigger channel_embedding_update
  before insert or update of name, topic
  on public.channels
  for each row
  execute function public.update_channel_embedding();

-- Drop existing message policies
drop policy if exists "Users can view messages in channels they are members of" on public.messages;
drop policy if exists "Users can create messages in channels they are members of" on public.messages;
drop policy if exists "Users can update their own messages" on public.messages;
drop policy if exists "Users can delete their own messages" on public.messages;

-- Create updated message policies
create policy "Users can view messages in channels they have access to"
  on public.messages for select
  using (
    exists (
      select 1 from public.channels c
      where c.id = messages.channel_id
      and (
        -- Channel is public and user is workspace member
        (not c.is_private and exists (
          select 1 from public.workspace_memberships wm
          where wm.workspace_id = c.workspace_id
          and wm.user_id = auth.uid()
        ))
        or
        -- User is channel member
        exists (
          select 1 from public.channel_memberships cm
          where cm.channel_id = c.id
          and cm.user_id = auth.uid()
        )
      )
    )
  );

create policy "Users can create messages in channels they are members of"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.channel_memberships
      where channel_id = messages.channel_id
      and user_id = auth.uid()
    )
  );

create policy "Users can update their own messages"
  on public.messages for update
  using (user_id = auth.uid());

create policy "Users can delete their own messages"
  on public.messages for delete
  using (user_id = auth.uid()); 