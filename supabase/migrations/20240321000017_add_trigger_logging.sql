-- Create logging table
create table if not exists trigger_logs (
    id uuid primary key default gen_random_uuid(),
    trigger_name text not null,
    message_id uuid,
    step text not null,
    details jsonb,
    created_at timestamptz default now()
);

-- Drop and recreate the trigger function with logging
drop trigger if exists generate_message_embedding_trigger on messages;
drop function if exists generate_message_embedding();

create or replace function generate_message_embedding()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  request_id text;
  is_private boolean;
begin
  -- Log trigger start
  insert into trigger_logs (trigger_name, message_id, step, details)
  values ('generate_message_embedding', NEW.id, 'start', jsonb_build_object(
    'content', substring(NEW.content, 1, 100),
    'channel_id', NEW.channel_id,
    'user_id', NEW.user_id
  ));

  -- Check channel privacy
  select c.is_private into is_private
  from channels c 
  where c.id = NEW.channel_id;

  -- Log channel check
  insert into trigger_logs (trigger_name, message_id, step, details)
  values ('generate_message_embedding', NEW.id, 'channel_check', jsonb_build_object(
    'channel_id', NEW.channel_id,
    'is_private', is_private,
    'channel_found', FOUND
  ));

  -- Only process messages from non-private channels
  if not is_private then
    -- Log HTTP call attempt
    insert into trigger_logs (trigger_name, message_id, step, details)
    values ('generate_message_embedding', NEW.id, 'http_call_start', jsonb_build_object(
      'url', 'https://clohwjjmidcucvvxgxaf.supabase.co/functions/v1/generate-embeddings'
    ));
    
    -- Call the Edge Function to generate embeddings
    begin
      SELECT net.http_post(
        'https://clohwjjmidcucvvxgxaf.supabase.co/functions/v1/generate-embeddings'::text,
        array[
          ('Content-Type', 'application/json'),
          ('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsb2h3amptaWRjdWN2dnhneGFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjIxNzQzNywiZXhwIjoyMDUxNzkzNDM3fQ.w52P0_40AJX1sOnZhlqIXCnVRPZXY8adlENFn2YtpCE')
        ]::net.http_header[],
        jsonb_build_object(
          'message_id', NEW.id,
          'content', NEW.content,
          'channel_id', NEW.channel_id,
          'user_id', NEW.user_id
        )::text
      ) INTO request_id;

      -- Log HTTP request ID
      insert into trigger_logs (trigger_name, message_id, step, details)
      values ('generate_message_embedding', NEW.id, 'http_call_queued', jsonb_build_object(
        'request_id', request_id
      ));
    exception
      when others then
        -- Log HTTP error
        insert into trigger_logs (trigger_name, message_id, step, details)
        values ('generate_message_embedding', NEW.id, 'http_call_error', jsonb_build_object(
          'error', SQLERRM,
          'state', SQLSTATE
        ));
    end;
  else
    -- Log skipped due to private channel
    insert into trigger_logs (trigger_name, message_id, step, details)
    values ('generate_message_embedding', NEW.id, 'skipped_private_channel', jsonb_build_object(
      'channel_id', NEW.channel_id
    ));
  end if;

  return NEW;
exception
  when others then
    -- Log unexpected error
    insert into trigger_logs (trigger_name, message_id, step, details)
    values ('generate_message_embedding', NEW.id, 'unexpected_error', jsonb_build_object(
      'error', SQLERRM,
      'state', SQLSTATE
    ));
    return NEW;
end;
$$;

-- Create trigger
create trigger generate_message_embedding_trigger
  after insert on messages
  for each row
  execute function generate_message_embedding(); 