-- Enable pgvector extension if not already enabled
create extension if not exists vector;

-- Create document_embeddings table
create table public.document_embeddings (
    id uuid primary key default gen_random_uuid(),
    file_id uuid references files(id) on delete cascade,
    chunk_text text not null,
    embedding vector(1536),
    metadata jsonb default '{}'::jsonb,
    workspace_id uuid references workspaces(id) on delete cascade not null,
    channel_id uuid references channels(id) on delete cascade,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Create indexes for better performance
create index if not exists document_embeddings_file_id_idx on document_embeddings(file_id);
create index if not exists document_embeddings_workspace_id_idx on document_embeddings(workspace_id);
create index if not exists document_embeddings_channel_id_idx on document_embeddings(channel_id);

-- Create an index for the vector column using cosine distance
create index document_embeddings_embedding_idx on document_embeddings 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create RLS policies
alter table public.document_embeddings enable row level security;

-- Read policy - users can read document embeddings if they have access to the file
create policy "Users can read document embeddings they have access to"
    on public.document_embeddings for select
    using (
        exists (
            select 1 from public.files f
            where f.id = document_embeddings.file_id
            and (
                -- User owns the file
                f.user_id = auth.uid()
                or
                -- File is in a channel user is member of
                (
                    f.channel_id is not null
                    and exists (
                        select 1 from public.channel_memberships
                        where channel_id = f.channel_id
                        and user_id = auth.uid()
                    )
                )
                or
                -- File is in workspace and user is member
                (
                    f.channel_id is null
                    and exists (
                        select 1 from public.workspace_memberships
                        where workspace_id = f.workspace_id
                        and user_id = auth.uid()
                    )
                )
            )
        )
    );

-- Create similarity search function for documents
create or replace function get_relevant_document_context(
    query_embedding vector(1536),
    workspace_id_filter uuid,
    similarity_threshold float default 0.8,
    max_results int default 5
) returns table (
    file_id uuid,
    chunk_text text,
    similarity float,
    metadata jsonb
)
language plpgsql
security definer
as $$
begin
    return query
    select
        de.file_id,
        de.chunk_text,
        1 - (de.embedding <=> query_embedding) as similarity,
        de.metadata
    from document_embeddings de
    where de.workspace_id = workspace_id_filter
        and 1 - (de.embedding <=> query_embedding) > similarity_threshold
    order by de.embedding <=> query_embedding
    limit max_results;
end;
$$; 