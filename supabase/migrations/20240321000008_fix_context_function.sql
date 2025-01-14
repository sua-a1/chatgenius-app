-- Drop the existing function
drop function if exists get_relevant_context;

-- Recreate with fixed column references
create or replace function get_relevant_context(
    query_embedding vector(1536),
    p_workspace_id uuid,
    similarity_threshold float default 0.8,
    max_results int default 5
) returns table (
    content text,
    similarity float,
    message_user_id uuid,      -- Renamed to avoid ambiguity
    message_workspace_id uuid,  -- Renamed to avoid ambiguity
    message_channel_id uuid,    -- Renamed to avoid ambiguity
    metadata jsonb
) language plpgsql as $$
begin
    return query
    select
        me.metadata->>'content' as content,
        (me.embedding <=> query_embedding) as similarity,
        me.user_id as message_user_id,           -- Aliased
        me.workspace_id as message_workspace_id,  -- Aliased
        me.channel_id as message_channel_id,      -- Aliased
        me.metadata
    from
        message_embeddings me
    where
        me.workspace_id = p_workspace_id
        and (me.embedding <=> query_embedding) <= similarity_threshold
    order by
        me.embedding <=> query_embedding
    limit max_results;
end;
$$; 