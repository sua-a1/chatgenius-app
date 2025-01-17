-- Drop existing tables and functions
drop table if exists document_embeddings cascade;
drop function if exists handle_document_update() cascade;

-- Create document_embeddings table
create table if not exists document_embeddings (
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

-- Create indexes
create index if not exists document_embeddings_file_id_idx on document_embeddings(file_id);
create index if not exists document_embeddings_channel_id_idx on document_embeddings(channel_id);
create index if not exists document_embeddings_workspace_id_idx on document_embeddings(workspace_id);
create unique index document_embeddings_latest_version_idx ON document_embeddings (file_id) WHERE is_latest = true;

-- Function to handle document updates
create or replace function handle_document_update()
returns trigger
language plpgsql security definer
as $$
declare
    current_version int;
    current_ts timestamptz;
    channel_workspace_id uuid;
begin
    -- Get current timestamp
    current_ts := now();

    -- Get workspace_id from channel if it exists
    if NEW.channel_id is not null then
        select workspace_id into channel_workspace_id
        from channels
        where id = NEW.channel_id;
    end if;

    -- Get the current version number
    select coalesce(max(version), 0)
    into current_version
    from document_embeddings
    where file_id = NEW.id;

    -- Mark existing document embedding as not latest
    update document_embeddings
    set is_latest = false,
        replaced_at = current_ts
    where file_id = NEW.id
    and is_latest = true;

    -- Create new version
    insert into document_embeddings (
        file_id,
        version,
        is_latest,
        is_deleted,
        deleted_at,
        replaced_at,
        original_document_content,
        channel_id,
        user_id,
        workspace_id,
        metadata,
        embedding
    )
    values (
        NEW.id,
        current_version + 1,
        true,
        false,
        null,
        null,
        null,
        NEW.channel_id,
        NEW.user_id,
        coalesce(channel_workspace_id, NEW.workspace_id),
        jsonb_build_object(
            'filename', NEW.filename,
            'file_type', NEW.file_type,
            'file_size', NEW.file_size,
            'file_url', NEW.file_url,
            'updated_at', current_ts
        ),
        null
    );

    -- Queue document for new embedding generation
    insert into pending_document_embeddings (file_id, status, attempts)
    values (NEW.id, 'pending', 0)
    on conflict (file_id) do update
    set status = 'pending',
        attempts = 0,
        error_message = null,
        updated_at = current_ts;

    return NEW;
end;
$$;

-- Create trigger for document updates
drop trigger if exists document_update_trigger on files;
create trigger document_update_trigger
    after insert or update of file_url on files
    for each row
    execute function handle_document_update();

-- Enable RLS
alter table document_embeddings enable row level security;

-- Create policies
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