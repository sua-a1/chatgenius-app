-- Add new columns to users table
alter table public.users
    add column if not exists full_name text;

-- Update existing rows with default values
update public.users set
    full_name = null where full_name is null; 