-- Remove the status column from users table since we now use user_presence for status tracking
alter table public.users drop column if exists status; 