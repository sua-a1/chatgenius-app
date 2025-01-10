-- Add created_at column to users table
alter table public.users
    add column if not exists created_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- Update existing users to have created_at based on auth.users
update public.users u
set created_at = au.created_at
from auth.users au
where u.id = au.id
and u.created_at is null; 