-- First, let's get our test data IDs
with test_data as (
    select 
        (select id from auth.users limit 1) as test_user_id,
        (select id from public.channels limit 1) as test_channel_id
)
-- Insert test messages with different characteristics
insert into messages (
    content,
    channel_id,
    user_id
) values 
-- Normal message
(
    'This is a test message about RAG implementation. We are testing our embedding pipeline.',
    (select test_channel_id from test_data),
    (select test_user_id from test_data)
),
-- Message with code blocks
(
    'Here is a code example: ```typescript const test = "RAG"; console.log(test);``` And some more text.',
    (select test_channel_id from test_data),
    (select test_user_id from test_data)
),
-- Long message that should be chunked
(
    'This is a very long message that should be split into multiple chunks. ' ||
    'It contains multiple sentences about different topics. ' ||
    'First, we talk about RAG implementation and vector databases. ' ||
    'Then we discuss how to properly chunk messages and generate embeddings. ' ||
    'Finally, we cover user context and metadata storage in our system. ' ||
    'This should help us test our chunking logic properly.',
    (select test_channel_id from test_data),
    (select test_user_id from test_data)
);

-- Verify messages were inserted
select id, content, user_id, channel_id
from messages
where content like '%RAG%'
order by created_at desc
limit 3; 