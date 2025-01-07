-- Add new columns to users table
alter table public.users
    add column if not exists full_name text,
    add column if not exists notifications jsonb default '{"email": true, "push": false}'::jsonb,
    add column if not exists theme text check (theme in ('light', 'dark')) default 'light';

-- Update existing rows with default values
update public.users set
    notifications = '{"email": true, "push": false}'::jsonb where notifications is null,
    theme = 'light' where theme is null; 