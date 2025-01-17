-- Function to get reply counts for multiple messages
CREATE OR REPLACE FUNCTION get_message_reply_counts(message_ids uuid[])
RETURNS TABLE (message_id uuid, count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT reply_to as message_id, COUNT(*) as count
  FROM messages
  WHERE reply_to = ANY(message_ids)
  GROUP BY reply_to;
END;
$$ LANGUAGE plpgsql;

-- Function to get reply count for a single message
CREATE OR REPLACE FUNCTION get_message_reply_count(message_id uuid)
RETURNS bigint AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM messages
    WHERE reply_to = message_id
  );
END;
$$ LANGUAGE plpgsql; 