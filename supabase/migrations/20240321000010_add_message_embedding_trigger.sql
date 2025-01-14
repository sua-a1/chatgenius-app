-- Create a table to track messages that need embeddings
create table if not exists pending_embeddings (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid references messages(id) on delete cascade,
  status text default 'pending',
  attempts int default 0,
  last_attempt timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create indexes for efficient querying
create index if not exists pending_embeddings_status_idx on pending_embeddings(status);
create index if not exists pending_embeddings_message_id_idx on pending_embeddings(message_id);

-- Function to handle new messages
create or replace function handle_new_message()
returns trigger
language plpgsql security definer as $$
begin
  -- Check if message is from a non-private channel
  if exists (
    select 1 
    from channels c 
    where c.id = NEW.channel_id 
    and not c.is_private
  ) then
    -- Insert into pending_embeddings
    insert into pending_embeddings (message_id, status)
    values (NEW.id, 'pending');
  end if;
  
  -- Always return NEW for AFTER triggers
  return NEW;
end;
$$;

-- Drop existing trigger if it exists
drop trigger if exists trigger_new_message_embedding on messages;

-- Create the trigger
create trigger trigger_new_message_embedding
  after insert on messages
  for each row
  execute function handle_new_message();

-- Create function to retry failed embeddings
create or replace function retry_failed_embeddings(max_attempts int default 3)
returns void as $$
begin
  update pending_embeddings
  set 
    status = 'pending',
    attempts = attempts + 1,
    updated_at = now()
  where 
    status = 'failed'
    and attempts < max_attempts
    and (last_attempt is null or last_attempt < now() - interval '5 minutes');
end;
$$ language plpgsql security definer; 