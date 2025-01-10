-- Drop existing policies if they exist
drop policy if exists "Anyone can read user presence" on public.user_presence;
drop policy if exists "Users can update their own presence" on public.user_presence;
drop policy if exists "Users can insert their own presence" on public.user_presence;

-- Enable RLS
alter table public.user_presence enable row level security;

-- Create policies
create policy "Anyone can read user presence"
    on public.user_presence for select
    using (true);

create policy "Users can insert their own presence"
    on public.user_presence for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own presence"
    on public.user_presence for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Grant necessary permissions
grant usage on schema public to authenticated;
grant all privileges on public.user_presence to authenticated; 