-- Create queue table for pending embeddings
create table if not exists pending_embeddings (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references messages(id),
    status text not null default 'pending',
    error_message text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    last_attempt timestamptz,
    attempts int default 0,
    constraint valid_status check (status in ('pending', 'processing', 'completed', 'failed'))
);

-- Create index for faster queue processing
create index if not exists pending_embeddings_status_idx on pending_embeddings(status, created_at);

-- Drop existing trigger and function
drop trigger if exists generate_message_embedding_trigger on messages;
drop function if exists generate_message_embedding();

-- Create simpler trigger function that just queues messages
create or replace function generate_message_embedding()
returns trigger
language plpgsql security definer
as $$
declare
  is_private boolean;
begin
  -- Check channel privacy
  select c.is_private into is_private
  from channels c 
  where c.id = NEW.channel_id;

  -- Only queue messages from non-private channels
  if not is_private then
    insert into pending_embeddings (message_id)
    values (NEW.id);
  end if;

  return NEW;
end;
$$;

-- Create trigger
create trigger generate_message_embedding_trigger
  after insert on messages
  for each row
  execute function generate_message_embedding(); 