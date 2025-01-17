-- Create message_embeddings table if it doesn't exist
create table if not exists message_embeddings (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references messages(id),
    embedding vector(1536),
    metadata jsonb,
    created_at timestamptz default now()
);

-- Create index for the message_id
create index if not exists message_embeddings_message_id_idx on message_embeddings(message_id);

-- Enable vector extension if not already enabled
create extension if not exists vector with schema extensions; 