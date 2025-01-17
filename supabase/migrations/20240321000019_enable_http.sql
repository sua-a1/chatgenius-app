-- Enable the http extension
create extension if not exists http with schema extensions;

-- Grant usage to authenticated users
grant usage on schema net to postgres, authenticated, anon, service_role; 