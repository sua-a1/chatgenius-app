-- Create presence table for real-time status tracking
create table if not exists public.user_presence (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    status text check (status in ('online', 'offline', 'away', 'busy')) default 'offline',
    last_seen timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (user_id)
);

-- Create indexes
create index idx_user_presence_user_id on public.user_presence(user_id);
create index idx_user_presence_status on public.user_presence(status);

-- Enable RLS
alter table public.user_presence enable row level security;

-- Create policies
create policy "Anyone can read user presence"
    on public.user_presence for select
    using (true);

create policy "Users can update their own presence"
    on public.user_presence for update
    using (auth.uid() = user_id);

-- Create function to handle presence updates
create or replace function public.handle_presence_update()
returns trigger
language plpgsql
security definer
as $$
begin
    insert into public.user_presence (user_id, status)
    values (new.id, 'offline')
    on conflict (user_id)
    do update set
        status = 'offline',
        last_seen = now(),
        updated_at = now();
    return new;
end;
$$;

-- Create trigger for new user signup
create trigger on_user_created
    after insert on public.users
    for each row execute procedure public.handle_presence_update(); 