-- Queue all existing messages from non-private channels that don't have embeddings yet
WITH messages_to_queue AS (
  SELECT m.id as message_id
  FROM messages m
  JOIN channels c ON m.channel_id = c.id
  LEFT JOIN message_embeddings me ON m.id = me.message_id
  WHERE NOT c.is_private
  AND me.id IS NULL  -- Only messages without embeddings
)
INSERT INTO pending_embeddings (message_id)
SELECT message_id
FROM messages_to_queue;

-- Show how many messages were queued
SELECT count(*) as queued_messages 
FROM pending_embeddings 
WHERE status = 'pending'; 