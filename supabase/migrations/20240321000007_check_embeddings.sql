-- Check message and embedding counts
select 
    count(distinct m.id) as total_messages,
    count(distinct me.message_id) as messages_with_embeddings,
    count(me.id) as total_embeddings
from messages m
left join message_embeddings me on m.id = me.message_id
where m.content like '%RAG%';

-- Show unprocessed messages
select 
    m.id,
    m.content,
    m.created_at
from messages m
left join message_embeddings me on m.id = me.message_id
where m.content like '%RAG%'
and me.id is null;

-- Show processed messages and their chunks
select 
    m.id as message_id,
    m.content as original_content,
    count(me.id) as chunk_count,
    array_agg(me.metadata->>'content') as chunk_contents
from messages m
join message_embeddings me on m.id = me.message_id
where m.content like '%RAG%'
group by m.id, m.content; 