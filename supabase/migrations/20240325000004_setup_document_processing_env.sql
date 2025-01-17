-- Enable net extension for HTTP requests
create extension if not exists "http" with schema extensions;
create extension if not exists "pg_net" with schema net;

-- Create custom settings schema if it doesn't exist
create schema if not exists app_settings;

-- Create settings table if it doesn't exist
create table if not exists app_settings.config (
    key text primary key,
    value text not null
);

-- Function to get setting with default
create or replace function app_settings.get_setting(p_key text, p_default text default null)
returns text
language plpgsql
security definer
as $$
declare
    v_value text;
begin
    select value into v_value
    from app_settings.config
    where key = p_key;
    
    return coalesce(v_value, p_default);
end;
$$;

-- Update settings
do $$
declare
    v_project_ref text;
    v_anon_key text;
    v_service_role_key text;
begin
    -- Get the project reference from the current database name
    select current_database() into v_project_ref;
    
    -- Construct Supabase URL from project ref
    insert into app_settings.config (key, value)
    values ('supabase_url', 'https://' || v_project_ref || '.supabase.co')
    on conflict (key) do update 
    set value = excluded.value;

    -- Set a placeholder for service_role_key - this needs to be updated manually
    insert into app_settings.config (key, value)
    values ('service_role_key', 'REPLACE_WITH_YOUR_SERVICE_ROLE_KEY')
    on conflict (key) do update 
    set value = excluded.value;

    raise notice 'Successfully initialized app settings. Please update service_role_key manually using:';
    raise notice 'update app_settings.config set value = ''your-actual-service-role-key'' where key = ''service_role_key'';';
end;
$$; 