-- Enable the pg_cron extension
create extension if not exists pg_cron;

-- Create a function to invoke our edge function
create or replace function invoke_generate_embeddings()
returns void
language plpgsql
security definer
as $$
begin
  perform
    net.http_get(
      'https://clohwjjmidcucvvxgxaf.supabase.co/functions/v1/generate-embeddings'
    );
end;
$$;

-- Schedule the function to run every minute
select
  cron.schedule(
    'process-embeddings',  -- name of the cron job
    '* * * * *',          -- every minute
    'select invoke_generate_embeddings()'
  );

-- Grant necessary permissions
grant execute on function invoke_generate_embeddings to postgres; 