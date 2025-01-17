-- Drop existing objects if they exist
DROP TRIGGER IF EXISTS trigger_new_message_embedding ON messages;
DROP FUNCTION IF EXISTS handle_new_message();
DROP TABLE IF EXISTS pending_embeddings;

-- Create function to handle new messages
CREATE OR REPLACE FUNCTION handle_new_message()
RETURNS TRIGGER AS $$
DECLARE
  channel_type text;
  response json;
BEGIN
  -- Get channel type
  SELECT type INTO channel_type
  FROM channels
  WHERE id = NEW.channel_id;

  -- Only process messages from non-private channels
  IF channel_type != 'private' THEN
    -- Call Edge Function to generate embedding
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-embeddings',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'message_id', NEW.id,
        'content', NEW.content,
        'channel_id', NEW.channel_id,
        'user_id', NEW.user_id
      )
    ) INTO response;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new messages
CREATE TRIGGER trigger_new_message_embedding
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_message(); 