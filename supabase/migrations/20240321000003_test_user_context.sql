-- First, let's check our tables structure
select 
    table_name,
    column_name,
    data_type
from information_schema.columns 
where table_name in ('messages', 'message_embeddings')
order by table_name, ordinal_position;

-- Then insert a test message (we'll modify this after seeing the actual structure)
/* Commenting out until we verify structure
insert into public.messages (
    content,
    workspace_id,
    channel_id,
    user_id,
    replied_to_user
) values (
    'This is a test message with user context. It contains some technical information about RAG implementation and vector databases.',
    (select id from public.workspaces limit 1),
    (select id from public.channels limit 1),
    (select id from auth.users limit 1),
    null
) returning id;
*/

-- Verify message_embeddings table structure
select 
    column_name, 
    data_type 
from information_schema.columns 
where table_name = 'message_embeddings';

-- Verify RLS policies
select 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
from pg_policies 
where tablename = 'message_embeddings';

-- Test the get_relevant_context function exists
select 
    proname,
    proargnames,
    prosrc
from pg_proc 
where proname = 'get_relevant_context'; 