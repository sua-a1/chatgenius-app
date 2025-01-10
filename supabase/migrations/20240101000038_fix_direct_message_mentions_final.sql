-- Create direct message mentions table
create table if not exists public.direct_message_mentions (
    id uuid default gen_random_uuid() primary key,
    direct_message_id uuid references public.direct_messages(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    created_at timestamptz default now() not null,
    unique (direct_message_id, user_id)
);

-- Create indexes
create index if not exists idx_direct_message_mentions_message_id on public.direct_message_mentions(direct_message_id);
create index if not exists idx_direct_message_mentions_user_id on public.direct_message_mentions(user_id);

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

-- Create function to handle direct message mentions
create or replace function public.handle_direct_message_mentions()
returns trigger
language plpgsql
security definer
as $$
declare
    mention_match text;
    mentioned_user_id uuid;
begin
    -- Extract mentions from message content (e.g., @username)
    for mention_match in
        select (regexp_matches(NEW.message, '@(\w+)', 'g'))[1]
    loop
        -- Find the user ID for the mentioned username
        select id into mentioned_user_id
        from public.users
        where username = mention_match;

        if mentioned_user_id is not null then
            -- Insert into direct_message_mentions
            insert into public.direct_message_mentions (direct_message_id, user_id)
            values (NEW.id, mentioned_user_id)
            on conflict (direct_message_id, user_id) do nothing;
        end if;
    end loop;

    return NEW;
end;
$$;

-- Create trigger for direct message mentions
create trigger handle_direct_message_mentions
    after insert on public.direct_messages
    for each row
    execute function public.handle_direct_message_mentions(); 