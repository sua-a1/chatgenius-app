-- Drop all existing tables and functions
drop table if exists pending_document_embeddings cascade;
drop table if exists document_embeddings cascade;
drop function if exists is_supported_document_type cascade;
drop function if exists handle_new_file cascade;
drop function if exists process_pending_documents cascade;

-- Create document_embeddings table
create table document_embeddings (
    id uuid primary key default gen_random_uuid(),
    file_id uuid not null references files(id),
    version integer NOT NULL DEFAULT 1,
    is_latest boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz,
    replaced_at timestamptz,
    original_document_content text,
    channel_id uuid references channels(id),
    user_id uuid not null references auth.users(id),
    workspace_id uuid not null references workspaces(id),
    metadata jsonb,
    embedding vector(1536),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Create document_embeddings indexes
create index document_embeddings_file_id_idx on document_embeddings(file_id);
create index document_embeddings_channel_id_idx on document_embeddings(channel_id);
create index document_embeddings_workspace_id_idx on document_embeddings(workspace_id);
create unique index document_embeddings_latest_version_idx ON document_embeddings (file_id) WHERE is_latest = true;

-- Create pending_document_embeddings table
create table pending_document_embeddings (
    id uuid primary key default gen_random_uuid(),
    file_id uuid not null references files(id),
    status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    error_message text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    last_attempt timestamptz,
    attempts int default 0
);

-- Create pending_document_embeddings indexes
create index pending_document_embeddings_status_idx on pending_document_embeddings(status, created_at);
create unique index pending_document_embeddings_file_id_idx on pending_document_embeddings(file_id);

-- Enable RLS
alter table document_embeddings enable row level security;
alter table pending_document_embeddings enable row level security;

-- Create RLS policies
create policy "Service role can do anything" on document_embeddings
    using (true)
    with check (true);

create policy "Users can read document embeddings from their workspaces" on document_embeddings
    for select
    using (
        workspace_id in (
            select workspace_id 
            from workspace_members 
            where user_id = auth.uid()
        )
    );

create policy "Service role can do anything" on pending_document_embeddings
    using (true)
    with check (true);

-- Function to check if file type is supported
create or replace function is_supported_document_type(file_type text)
returns boolean
language plpgsql
as $$
begin
    return file_type in (
        'text/plain',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
    );
end;
$$;

-- Function to handle new file uploads
create or replace function handle_new_file()
returns trigger
language plpgsql
security definer
as $$
begin
    -- Only process supported document types
    if is_supported_document_type(new.file_type) then
        -- Add to pending embeddings queue
        insert into pending_document_embeddings (file_id)
        values (new.id)
        on conflict (file_id) do update
        set status = 'pending',
            attempts = 0,
            error_message = null,
            updated_at = now();
    end if;

    return new;
end;
$$;

-- Create trigger for new file uploads
drop trigger if exists on_file_created on files;
create trigger on_file_created
    after insert on files
    for each row
    execute function handle_new_file();

-- Queue existing files that don't have embeddings
insert into pending_document_embeddings (file_id)
select id from files f
where f.file_type in (
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
)
and id not in (
    select file_id from document_embeddings where is_latest = true
)
on conflict (file_id) do update
set status = 'pending',
    attempts = 0,
    error_message = null,
    updated_at = now(); 