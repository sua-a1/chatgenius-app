-- Drop existing triggers and functions
drop trigger if exists trigger_new_message_embedding on messages;
drop trigger if exists generate_embedding_trigger on messages;
drop trigger if exists generate_message_embedding_trigger on messages;
drop function if exists handle_new_message();
drop function if exists trigger_generate_embedding();
drop function if exists generate_message_embedding();

-- Create function to generate embeddings directly
create or replace function generate_message_embedding()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  response_status int;
  response_body text;
  is_private boolean;
begin
  -- Log initial trigger fire with message details
  raise notice E'\n\n[DEBUG] Trigger fired for message: % with content: %', NEW.id, NEW.content;

  -- Check channel privacy and log result
  begin
    select c.is_private into is_private
    from channels c 
    where c.id = NEW.channel_id;
    
    if not FOUND then
      raise notice E'\n\n[DEBUG] Channel not found: %', NEW.channel_id;
      return NEW;
    end if;
  exception
    when others then
      raise notice E'\n\n[ERROR] Error checking channel privacy: % %', SQLERRM, SQLSTATE;
      return NEW;
  end;
  
  raise notice E'\n\n[DEBUG] Channel check - id: %, private: %', NEW.channel_id, is_private;

  -- Only process messages from non-private channels
  if not is_private then
    raise notice E'\n\n[DEBUG] Processing message for non-private channel';
    
    -- Call the Edge Function to generate embeddings
    begin
      select
        status, content
      into
        response_status, response_body
      from
        net.http_post(
          url := 'https://clohwjjmidcucvvxgxaf.supabase.co/functions/v1/generate-embeddings',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsb2h3amptaWRjdWN2dnhneGFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjIxNzQzNywiZXhwIjoyMDUxNzkzNDM3fQ.w52P0_40AJX1sOnZhlqIXCnVRPZXY8adlENFn2YtpCE'
          ),
          body := jsonb_build_object(
            'message_id', NEW.id,
            'content', NEW.content,
            'channel_id', NEW.channel_id,
            'user_id', NEW.user_id
          )
        );

      raise notice E'\n\n[DEBUG] HTTP Response - Status: %, Body: %', response_status, response_body;
    exception
      when others then
        raise notice E'\n\n[ERROR] Failed to call edge function: % %', SQLERRM, SQLSTATE;
        return NEW;
    end;
  else
    raise notice E'\n\n[DEBUG] Skipping private channel message';
  end if;

  return NEW;
exception
  when others then
    raise notice E'\n\n[ERROR] Unexpected error: % %', SQLERRM, SQLSTATE;
    return NEW;
end;
$$;

-- Create trigger for direct embedding generation
create trigger generate_message_embedding_trigger
  after insert on messages
  for each row
  execute function generate_message_embedding();

-- Drop the pending_embeddings table since we're not using it anymore
drop table if exists pending_embeddings; 