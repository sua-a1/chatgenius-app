-- Enable pg_cron extension if not already enabled
create extension if not exists pg_cron;

-- Create a function to check if file type is supported
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

-- Create a function to invoke the edge function
create or replace function process_pending_documents()
returns void
language plpgsql
security definer
as $$
declare
    pending_doc record;
    edge_function_url text;
    response_status int;
    response_body json;
    service_role_key text;
    response_text text;
begin
    -- Get environment variables from settings table using our custom function
    edge_function_url := app_settings.get_setting('supabase_url') || '/functions/v1/process-document';
    service_role_key := app_settings.get_setting('service_role_key');

    raise notice 'Starting document processing with URL: %', edge_function_url;

    -- Get pending documents
    for pending_doc in
        select 
            pde.id,
            pde.file_id,
            f.workspace_id,
            f.channel_id,
            f.user_id,
            f.file_type
        from pending_document_embeddings pde
        inner join files f on f.id = pde.file_id
        where pde.status = 'pending'
        and is_supported_document_type(f.file_type) -- Only process supported file types
        and (pde.attempts < 3 or pde.attempts is null)  -- Limit retries
        and (pde.last_attempt is null or pde.last_attempt < now() - interval '5 minutes')  -- Prevent too frequent retries
        limit 50
    loop
        begin
            raise notice 'Processing document: % (type: %)', pending_doc.file_id, pending_doc.file_type;

            -- Mark as processing
            update pending_document_embeddings
            set status = 'processing',
                last_attempt = now(),
                attempts = coalesce(attempts, 0) + 1,
                updated_at = now()
            where id = pending_doc.id;

            -- Call edge function
            select 
                status as _status,
                content::json as _content,
                content::text as _text
            into response_status, response_body, response_text
            from net.http_post(
                url := edge_function_url,
                headers := jsonb_build_object(
                    'Authorization', 'Bearer ' || service_role_key,
                    'Content-Type', 'application/json'
                ),
                body := jsonb_build_object(
                    'fileId', pending_doc.file_id,
                    'workspaceId', pending_doc.workspace_id,
                    'channelId', pending_doc.channel_id,
                    'userId', pending_doc.user_id
                )
            );

            raise notice 'Response status: %, body: %', response_status, response_text;

            -- Verify the document was actually created
            if response_status = 200 and (response_body->>'success')::boolean then
                -- Check if document was actually created
                perform id 
                from document_embeddings 
                where file_id = pending_doc.file_id 
                and is_latest = true
                limit 1;

                if found then
                    -- Mark as completed only if document exists
                    update pending_document_embeddings
                    set status = 'completed',
                        updated_at = now()
                    where id = pending_doc.id;

                    raise notice 'Successfully processed document: %', pending_doc.file_id;
                else
                    -- Mark as failed if document wasn't created
                    update pending_document_embeddings
                    set status = 'failed',
                        error_message = 'Edge function returned success but document was not created',
                        updated_at = now()
                    where id = pending_doc.id;

                    raise notice 'Document not created despite success response: %', pending_doc.file_id;
                end if;
            else
                -- Mark as failed if unsuccessful
                update pending_document_embeddings
                set status = 'failed',
                    error_message = coalesce(
                        response_body->>'error', 
                        'HTTP Status: ' || response_status || ', Response: ' || response_text
                    ),
                    updated_at = now()
                where id = pending_doc.id;

                raise notice 'Failed to process document: %, error: %', pending_doc.file_id, coalesce(response_body->>'error', response_text);
            end if;

        exception when others then
            -- Mark as failed on error
            update pending_document_embeddings
            set status = 'failed',
                error_message = SQLERRM,
                updated_at = now()
            where id = pending_doc.id;

            raise notice 'Exception while processing document: %, error: %', pending_doc.file_id, SQLERRM;
        end;
    end loop;
end;
$$;

-- Drop existing schedule if it exists
select cron.unschedule('process-pending-documents');

-- Create a scheduled job to run every minute
select cron.schedule(
    'process-pending-documents',  -- job name
    '* * * * *',                 -- every minute
    'select process_pending_documents()'
); 