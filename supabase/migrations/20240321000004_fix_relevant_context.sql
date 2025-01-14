-- Drop the existing function
drop function if exists get_relevant_context;

-- Recreate the function without openai dependency
create or replace function get_relevant_context(
    query_embedding vector(1536),  -- Pass pre-computed embedding instead
    p_workspace_id uuid,
    similarity_threshold float default 0.8,
    max_results int default 5
) returns table (
    content text,
    similarity float,
    user_id uuid,
    workspace_id uuid,
    channel_id uuid,
    metadata jsonb
) language plpgsql as $$
begin
    return query
    select
        me.metadata->>'content' as content,
        (me.embedding <=> query_embedding) as similarity,  -- Use passed embedding
        me.user_id,
        me.workspace_id,
        me.channel_id,
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