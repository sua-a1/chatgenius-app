-- Drop existing function and table
DROP FUNCTION IF EXISTS get_relevant_context(vector,uuid,uuid,float,integer);
DROP TABLE IF EXISTS message_embeddings;

-- Recreate with updated schema
CREATE TABLE message_embeddings (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid references messages(id) on delete cascade,
  embedding vector(1536), -- OpenAI's text-embedding-ada-002 uses 1536 dimensions
  channel_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null,
  topic text,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create an index for the vector column using cosine distance
CREATE INDEX message_embeddings_embedding_idx ON message_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create indexes for efficient lookups
CREATE INDEX message_embeddings_message_id_idx ON message_embeddings(message_id);
CREATE INDEX message_embeddings_channel_id_idx ON message_embeddings(channel_id);
CREATE INDEX message_embeddings_workspace_id_idx ON message_embeddings(workspace_id);
CREATE INDEX message_embeddings_user_id_idx ON message_embeddings(user_id);

-- Function to get relevant context based on similarity search
CREATE OR REPLACE FUNCTION get_relevant_context(
  query_embedding vector(1536),
  workspace_id_filter uuid,
  channel_id_filter uuid,
  similarity_threshold float default 0.8,
  max_results int default 5
) RETURNS TABLE (
  message_id uuid,
  content text,
  topic text,
  user_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as message_id,
    m.content,
    m.topic,
    m.user_id,
    1 - (me.embedding <=> query_embedding) as similarity
  FROM message_embeddings me
  JOIN messages m ON m.id = me.message_id
  WHERE me.workspace_id = workspace_id_filter
    AND (channel_id_filter IS NULL OR me.channel_id = channel_id_filter)
    AND 1 - (me.embedding <=> query_embedding) > similarity_threshold
    AND NOT m.private  -- Exclude private messages from context
  ORDER BY me.embedding <=> query_embedding
  LIMIT max_results;
END;
$$;

-- Set up RLS policies
ALTER TABLE public.message_embeddings ENABLE ROW LEVEL SECURITY;

-- Read policy: users can read embeddings from workspaces they have access to
CREATE POLICY "Users can read embeddings from their workspaces"
    ON public.message_embeddings
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT w.id 
            FROM workspaces w
            JOIN workspace_members wm ON wm.workspace_id = w.id
            WHERE wm.user_id = auth.uid()
        )
    );

-- Write policy: only the system can insert/update embeddings
CREATE POLICY "System can manage embeddings"
    ON public.message_embeddings
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT SELECT ON public.message_embeddings TO authenticated;
GRANT ALL ON public.message_embeddings TO service_role; 