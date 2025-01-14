-- Add user context to message_embeddings table
alter table public.message_embeddings
    add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Update RLS policies to include user context
create policy "Users can read embeddings from messages they sent"
    on public.message_embeddings
    for select
    using (
        user_id = auth.uid() or
        workspace_id in (
            select workspace_id 
            from public.workspace_members 
            where user_id = auth.uid()
        )
    );

-- Create index for user-based queries
create index if not exists idx_message_embeddings_user_id
    on public.message_embeddings(user_id);

-- Add function to get relevant context by user
create or replace function get_relevant_context(
    query_text text,
    p_workspace_id uuid,
    p_user_id uuid,
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
        (me.embedding <=> embedding_vector) as similarity,
        me.user_id,
        me.workspace_id,
        me.channel_id,
        me.metadata
    from
        message_embeddings me,
        openai.embedding_create(query_text) embedding_vector
    where
        me.workspace_id = p_workspace_id
        and (
            -- Messages from the same user
            me.user_id = p_user_id
            -- Or messages in shared workspaces
            or me.workspace_id in (
                select workspace_id 
                from workspace_members 
                where user_id = p_user_id
            )
        )
    order by
        me.embedding <=> embedding_vector
    limit max_results;
end;
$$; 