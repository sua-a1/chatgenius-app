-- First, find a non-private channel and its workspace
WITH test_channel AS (
  SELECT c.id as channel_id, c.workspace_id, u.id as user_id
  FROM channels c
  JOIN workspace_memberships wm ON c.workspace_id = wm.workspace_id
  JOIN auth.users u ON wm.user_id = u.id
  WHERE NOT c.is_private
  LIMIT 1
)
INSERT INTO messages (channel_id, user_id, content)
SELECT 
  channel_id,
  user_id,
  'Test message for embedding trigger at ' || now()
FROM test_channel
RETURNING id;

-- Wait a moment for trigger to complete
SELECT pg_sleep(1);

-- Check trigger logs for the last minute
SELECT 
  step,
  details,
  created_at
FROM trigger_logs
WHERE created_at > now() - interval '1 minute'
ORDER BY created_at DESC; 