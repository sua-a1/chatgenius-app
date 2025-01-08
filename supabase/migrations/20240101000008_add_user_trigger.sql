-- Create users table if it doesn't exist
create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    username text,
    email text not null,
    avatar_url text,
    full_name text,
    notifications jsonb default '{"email": true, "push": true}'::jsonb,
    theme text default 'light',
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.users enable row level security;

-- Create policies
create policy "Users can view their own profile"
    on public.users
    for select
    using (auth.uid() = id);

create policy "Users can update their own profile"
    on public.users
    for update
    using (auth.uid() = id);

-- Create function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.users (id, email, username)
    values (new.id, new.email, new.raw_user_meta_data->>'username');
    return new;
end;
$$;

-- Create trigger for new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user(); 