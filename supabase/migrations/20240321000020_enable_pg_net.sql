-- Enable net schema access
grant usage on schema net to postgres, authenticated, anon, service_role;
grant all privileges on all tables in schema net to postgres, authenticated, anon, service_role; 