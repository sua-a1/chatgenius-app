-- Create message reactions table
CREATE TABLE public.message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (message_id, user_id, emoji)
);

-- Create direct message reactions table
CREATE TABLE public.direct_message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  direct_message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (direct_message_id, user_id, emoji)
);

-- Create view for message reactions with user details
CREATE VIEW public.message_reactions_with_users AS
SELECT
  mr.id,
  mr.message_id,
  mr.user_id,
  mr.emoji,
  mr.created_at,
  u.username,
  u.avatar_url
FROM public.message_reactions mr
JOIN auth.users u ON u.id = mr.user_id;

-- Create view for direct message reactions with user details
CREATE VIEW public.direct_message_reactions_with_users AS
SELECT
  dmr.id,
  dmr.direct_message_id,
  dmr.user_id,
  dmr.emoji,
  dmr.created_at,
  u.username,
  u.avatar_url
FROM public.direct_message_reactions dmr
JOIN auth.users u ON u.id = dmr.user_id;

-- Enable RLS for message reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Enable RLS for direct message reactions
ALTER TABLE public.direct_message_reactions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view message reactions in their channels
CREATE POLICY "Users can view message reactions in their channels" ON public.message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.channels c ON c.id = m.channel_id
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE m.id = message_reactions.message_id
      AND wm.user_id = auth.uid()
    )
  );

-- Create policy to allow users to view direct message reactions in their conversations
CREATE POLICY "Users can view direct message reactions in their conversations" ON public.direct_message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.direct_messages dm
      WHERE dm.id = direct_message_reactions.direct_message_id
      AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
    )
  );

-- Create policy to allow users to add reactions to messages in their channels
CREATE POLICY "Users can add reactions to messages in their channels" ON public.message_reactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.channels c ON c.id = m.channel_id
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE m.id = message_reactions.message_id
      AND wm.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Create policy to allow users to add reactions to direct messages in their conversations
CREATE POLICY "Users can add reactions to direct messages in their conversations" ON public.direct_message_reactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.direct_messages dm
      WHERE dm.id = direct_message_reactions.direct_message_id
      AND (dm.sender_id = auth.uid() OR dm.receiver_id = auth.uid())
    )
    AND user_id = auth.uid()
  );

-- Create policy to allow users to remove their own reactions from messages
CREATE POLICY "Users can remove their own reactions from messages" ON public.message_reactions
  FOR DELETE
  USING (user_id = auth.uid());

-- Create policy to allow users to remove their own reactions from direct messages
CREATE POLICY "Users can remove their own reactions from direct messages" ON public.direct_message_reactions
  FOR DELETE
  USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX message_reactions_message_id_idx ON public.message_reactions(message_id);
CREATE INDEX message_reactions_user_id_idx ON public.message_reactions(user_id);
CREATE INDEX direct_message_reactions_direct_message_id_idx ON public.direct_message_reactions(direct_message_id);
CREATE INDEX direct_message_reactions_user_id_idx ON public.direct_message_reactions(user_id); 