-- Drop the function if it exists
DROP FUNCTION IF EXISTS public.get_recent_chats(uuid, uuid);

-- Function to get recent chats for a user in a workspace
CREATE OR REPLACE FUNCTION public.get_recent_chats(
  workspace_id_param uuid,
  user_id_param uuid
)
RETURNS TABLE (
  user_id uuid,
  username text,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz,
  last_message_at timestamptz
) AS $function$
BEGIN
  RETURN QUERY
  WITH workspace_users AS (
    -- Get all users in the workspace except the current user
    SELECT 
      u.id,
      u.username,
      u.full_name,
      u.email,
      u.avatar_url,
      u.created_at
    FROM public.users u
    JOIN workspace_memberships wm ON wm.user_id = u.id
    WHERE wm.workspace_id = workspace_id_param
    AND u.id != user_id_param
  ),
  last_messages AS (
    -- Get the most recent message timestamp for each user
    SELECT 
      CASE 
        WHEN dm.sender_id = user_id_param THEN dm.receiver_id
        ELSE dm.sender_id
      END as chat_user_id,
      MAX(dm.created_at) as last_message_at
    FROM direct_messages dm
    WHERE dm.workspace_id = workspace_id_param
    AND (dm.sender_id = user_id_param OR dm.receiver_id = user_id_param)
    GROUP BY chat_user_id
  )
  SELECT 
    wu.id as user_id,
    wu.username,
    wu.full_name,
    wu.email,
    wu.avatar_url,
    wu.created_at,
    COALESCE(lm.last_message_at, '1970-01-01'::timestamptz) as last_message_at
  FROM workspace_users wu
  LEFT JOIN last_messages lm ON lm.chat_user_id = wu.id
  ORDER BY last_message_at DESC;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_recent_chats(uuid, uuid) TO authenticated; 