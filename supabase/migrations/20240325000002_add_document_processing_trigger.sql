-- Create pending_document_embeddings table
create table if not exists public.pending_document_embeddings (
    id uuid primary key default gen_random_uuid(),
    file_id uuid references files(id) on delete cascade not null,
    status text check (status in ('pending', 'processing', 'completed', 'failed')) default 'pending',
    attempts int default 0,
    last_attempt timestamptz,
    error_message text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Create indexes for better performance
create index if not exists pending_document_embeddings_file_id_idx 
    on pending_document_embeddings(file_id);
create index if not exists pending_document_embeddings_status_idx 
    on pending_document_embeddings(status);

-- Function to check if file type is supported for document processing
create or replace function is_supported_document_type(file_type text)
returns boolean
language plpgsql
as $$
begin
    return file_type in (
        'text/plain',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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
        insert into pending_document_embeddings (
            file_id,
            created_at,
            updated_at
        ) values (
            new.id,
            now(),
            now()
        );
    end if;

    return new;
end;
$$;

-- Create trigger for new file uploads
drop trigger if exists on_file_created on public.files;
create trigger on_file_created
    after insert on public.files
    for each row
    execute function handle_new_file();

-- Enable RLS on pending_document_embeddings
alter table public.pending_document_embeddings enable row level security;

-- Create policy for reading pending documents
create policy "Service role can read pending documents"
    on public.pending_document_embeddings
    for select
    using (
        -- Only allow service role to read
        (select current_setting('request.jwt.claims', true)::json->>'role')::text = 'service_role'
    );

-- Create policy for updating pending documents
create policy "Service role can update pending documents"
    on public.pending_document_embeddings
    for update
    using (
        -- Only allow service role to update
        (select current_setting('request.jwt.claims', true)::json->>'role')::text = 'service_role'
    );

-- Create policy for inserting pending documents
create policy "Service role can insert pending documents"
    on public.pending_document_embeddings
    for insert
    with check (
        -- Only allow service role to insert
        (select current_setting('request.jwt.claims', true)::json->>'role')::text = 'service_role'
    ); 