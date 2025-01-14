-- Check which messages have been embedded
with message_stats as (
    select 
        m.id as message_id,
        m.content,
        count(me.id) as embedding_chunks,
        max(me.created_at) as embedded_at
    from messages m
    left join message_embeddings me on m.id = me.message_id
    where m.content like '%RAG%'
    group by m.id, m.content
)
select 
    message_id,
    content,
    embedding_chunks,
    embedded_at,
    case 
        when embedding_chunks = 0 then 'Not embedded'
        when embedding_chunks = 1 then 'Single chunk'
        else 'Multiple chunks'
    end as status
from message_stats;

-- Verify metadata storage
select 
    me.message_id,
    me.metadata->>'content' as chunk_content,
    me.metadata->>'chunk_index' as chunk_index,
    me.metadata->>'total_chunks' as total_chunks,
    me.metadata->>'user_id' as user_id,
    vector_dims(me.embedding) as embedding_dimension
from message_embeddings me
join messages m on me.message_id = m.id
where m.content like '%RAG%'
order by me.message_id, (me.metadata->>'chunk_index')::int;

-- Test retrieval with our get_relevant_context function
with zero_vector as (
    select array_fill(0::float8, ARRAY[1536])::vector(1536) as v
)
select * from get_relevant_context(
    (select v from zero_vector),  -- Zero vector with correct dimensions
    (select workspace_id from workspace_members limit 1),
    0.8,
    5
); 