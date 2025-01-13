-- Drop the old function
drop function if exists public.generate_embeddings(text);

-- Create the updated function that calls the Edge function
create or replace function public.generate_embeddings(input text)
returns vector
language plpgsql
security definer
as $$
declare
  embedding_response json;
  embedding vector(1536);
begin
  -- Call the Edge function
  select
    content::json->'embedding'
  into embedding_response
  from
    http((
      'POST',
      current_setting('app.edge_function_url') || '/generate-embeddings',
      ARRAY[http_header('Content-Type', 'application/json')],
      concat('{"input":"', replace(input, '"', '\"'), '"}'),
      10
    ));

  -- Convert the JSON array to a vector
  embedding := embedding_response::vector;
  
  return embedding;
end;
$$; 