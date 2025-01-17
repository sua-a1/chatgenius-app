-- Create app_settings schema if it doesn't exist
create schema if not exists app_settings;

-- Create config table to store settings
create table if not exists app_settings.config (
    key text primary key,
    value text not null,
    description text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Function to get setting with default value
create or replace function app_settings.get_setting(setting_key text)
returns text
language plpgsql
security definer
as $$
declare
    setting_value text;
begin
    select value into setting_value
    from app_settings.config
    where key = setting_key;
    
    return setting_value;
end;
$$;

-- Insert initial settings if they don't exist
insert into app_settings.config (key, value, description)
values 
    ('supabase_url', current_setting('SUPABASE_URL'), 'Supabase project URL'),
    ('service_role_key', current_setting('SUPABASE_SERVICE_ROLE_KEY'), 'Supabase service role key')
on conflict (key) do update
set value = excluded.value,
    updated_at = now(); 