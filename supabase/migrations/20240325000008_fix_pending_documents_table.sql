-- Drop and recreate the pending_document_embeddings table with all required columns
drop table if exists pending_document_embeddings;

create table if not exists pending_document_embeddings (
    id uuid primary key default gen_random_uuid(),
    file_id uuid not null references files(id),
    status text not null default 'pending',
    error_message text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    last_attempt timestamptz,
    attempts int default 0,
    constraint valid_status check (status in ('pending', 'processing', 'completed', 'failed'))
);

-- Create index for faster queue processing
create index if not exists pending_document_embeddings_status_idx on pending_document_embeddings(status, created_at);

-- Add unique constraint on file_id
alter table pending_document_embeddings
add constraint pending_document_embeddings_file_id_key unique (file_id);

-- Enable RLS
alter table pending_document_embeddings enable row level security;

-- Create policies
create policy "Service role can do anything" on pending_document_embeddings
    using (true)
    with check (true); 