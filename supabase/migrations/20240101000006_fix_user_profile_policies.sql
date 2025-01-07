-- Drop existing user policies
drop policy if exists "user_manage_own_profile" on public.users;
drop policy if exists "Users can view their own profile" on public.users;
drop policy if exists "Users can update their own profile" on public.users;

-- Create new user policies
create policy "users_select"
    on public.users
    for select
    using (auth.uid() = id);

create policy "users_update"
    on public.users
    for update
    using (auth.uid() = id)
    with check (auth.uid() = id); 