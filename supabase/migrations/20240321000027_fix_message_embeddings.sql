-- Drop existing table
drop table if exists message_embeddings;

-- Recreate with correct structure
create table message_embeddings (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references messages(id),
    channel_id uuid not null references channels(id),
    user_id uuid not null references auth.users(id),
    embedding vector(1536),
    metadata jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Create indexes
create index if not exists message_embeddings_message_id_idx on message_embeddings(message_id);
create index if not exists message_embeddings_channel_id_idx on message_embeddings(channel_id);
create index if not exists message_embeddings_user_id_idx on message_embeddings(user_id); 