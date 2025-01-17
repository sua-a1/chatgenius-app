-- Queue all existing files that don't have embeddings yet
with files_to_queue as (
    select f.id as file_id
    from files f
    left join document_embeddings de on f.id = de.file_id
    where de.id is null  -- Only files without embeddings
)
insert into pending_document_embeddings (file_id, status, attempts)
select file_id, 'pending', 0
from files_to_queue
on conflict (file_id) do update
set status = 'pending',
    attempts = 0,
    error_message = null,
    updated_at = now();

-- Show how many documents were queued
select count(*) as queued_documents 
from pending_document_embeddings 
where status = 'pending'; 