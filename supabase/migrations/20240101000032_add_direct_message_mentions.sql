-- Create direct message mentions table
create table if not exists public.direct_message_mentions (
    id uuid default gen_random_uuid() primary key,
    direct_message_id uuid references public.direct_messages(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    created_at timestamptz default now() not null,
    unique (direct_message_id, user_id)
);

-- Create indexes
create index idx_direct_message_mentions_message_id on public.direct_message_mentions(direct_message_id);
create index idx_direct_message_mentions_user_id on public.direct_message_mentions(user_id);

-- Enable RLS
alter table public.direct_message_mentions enable row level security;

-- Create policies
create policy "Users can view mentions in their direct messages"
    on public.direct_message_mentions for select
    using (
        exists (
            select 1 from public.direct_messages dm
            where dm.id = direct_message_mentions.direct_message_id
            and (dm.sender_id = auth.uid() or dm.receiver_id = auth.uid())
        )
    );

create policy "Users can create mentions in their direct messages"
    on public.direct_message_mentions for insert
    with check (
        exists (
            select 1 from public.direct_messages dm
            where dm.id = direct_message_mentions.direct_message_id
            and dm.sender_id = auth.uid()
        )
    ); 