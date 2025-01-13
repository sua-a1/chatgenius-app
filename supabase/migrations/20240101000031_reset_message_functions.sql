-- Drop all existing message-related functions and policies
drop policy if exists "Users can view messages in channels they are members of" on public.messages;
drop policy if exists "Users can create messages in channels they are members of" on public.messages;
drop policy if exists "Users can update their own messages" on public.messages;
drop policy if exists "Users can delete their own messages" on public.messages;
drop policy if exists "message_read" on public.messages;
drop policy if exists "message_create" on public.messages;
drop policy if exists "message_update" on public.messages;
drop policy if exists "message_delete" on public.messages;
drop policy if exists "Users can view message reactions in their channels" on public.message_reactions;
drop policy if exists "Users can add reactions to messages in their channels" on public.message_reactions;
drop policy if exists "Users can remove their own reactions" on public.message_reactions;

drop function if exists public.get_thread_messages(uuid);
drop function if exists public.reply_to_message(uuid, text);
drop function if exists public.create_thread_reply(uuid, text);
drop trigger if exists update_message_reply_count on public.messages;
drop function if exists public.update_message_reply_count();

-- Drop dependent views and tables first
drop view if exists public.message_reactions_with_users;
drop table if exists public.user_mentions;
drop table if exists public.message_reactions;
drop table if exists public.messages cascade;

-- Recreate the messages table with correct structure
create table public.messages (
    id uuid default gen_random_uuid() primary key,
    content text not null,
    channel_id uuid references public.channels(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    reply_to uuid references public.messages(id) on delete set null,
    reply_count integer default 0,
    attachments jsonb default null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Recreate message reactions table
create table public.message_reactions (
    id uuid default gen_random_uuid() primary key,
    message_id uuid references public.messages(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    emoji text not null,
    created_at timestamptz default now() not null,
    unique (message_id, user_id, emoji)
);

-- Recreate user mentions table
create table public.user_mentions (
    id uuid default gen_random_uuid() primary key,
    message_id uuid references public.messages(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    created_at timestamptz default now() not null,
    unique (message_id, user_id)
);

-- Create indexes
create index idx_messages_channel_id on public.messages(channel_id);
create index idx_messages_user_id on public.messages(user_id);
create index idx_messages_reply_to on public.messages(reply_to);
create index idx_message_reactions_message_id on public.message_reactions(message_id);
create index idx_message_reactions_user_id on public.message_reactions(user_id);
create index idx_user_mentions_message_id on public.user_mentions(message_id);
create index idx_user_mentions_user_id on public.user_mentions(user_id);

-- Enable RLS
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;

-- Create basic message policies
create policy "Users can view messages in channels they are members of"
    on public.messages for select
    using (
        exists (
            select 1 from public.channel_memberships
            where channel_id = messages.channel_id
            and user_id = auth.uid()
        )
    );

create policy "Users can create messages in channels they are members of"
    on public.messages for insert
    with check (
        exists (
            select 1 from public.channel_memberships
            where channel_id = messages.channel_id
            and user_id = auth.uid()
        )
        and user_id = auth.uid()
    );

create policy "Users can update their own messages"
    on public.messages for update
    using (user_id = auth.uid());

create policy "Users can delete their own messages"
    on public.messages for delete
    using (user_id = auth.uid());

-- Create message reaction policies
create policy "Users can view message reactions in their channels"
    on public.message_reactions for select
    using (
        exists (
            select 1 from public.messages m
            join public.channel_memberships cm on cm.channel_id = m.channel_id
            where m.id = message_reactions.message_id
            and cm.user_id = auth.uid()
        )
    );

create policy "Users can add reactions to messages in their channels"
    on public.message_reactions for insert
    with check (
        exists (
            select 1 from public.messages m
            join public.channel_memberships cm on cm.channel_id = m.channel_id
            where m.id = message_reactions.message_id
            and cm.user_id = auth.uid()
        )
        and user_id = auth.uid()
    );

create policy "Users can remove their own reactions"
    on public.message_reactions for delete
    using (user_id = auth.uid());

-- Create view for message reactions with user details
create or replace view public.message_reactions_with_users as
select
    mr.id,
    mr.message_id,
    mr.user_id,
    mr.emoji,
    mr.created_at,
    u.username,
    u.avatar_url
from public.message_reactions mr
join public.users u on u.id = mr.user_id;

-- Create function to update reply counts
create or replace function public.update_message_reply_count()
returns trigger
language plpgsql
security definer
as $$
begin
    if TG_OP = 'INSERT' then
        if NEW.reply_to is not null then
            update public.messages
            set reply_count = reply_count + 1
            where id = NEW.reply_to;
        end if;
    elsif TG_OP = 'DELETE' then
        if OLD.reply_to is not null then
            update public.messages
            set reply_count = greatest(0, reply_count - 1)
            where id = OLD.reply_to;
        end if;
    end if;
    return null;
end;
$$;

-- Create trigger for reply count updates
create trigger update_message_reply_count
    after insert or delete on public.messages
    for each row
    execute function public.update_message_reply_count();

-- Create function to get thread messages
create or replace function public.get_thread_messages(thread_id uuid)
returns table (
    id uuid,
    channel_id uuid,
    user_id uuid,
    content text,
    reply_to uuid,
    reply_count integer,
    created_at timestamptz,
    updated_at timestamptz,
    username text,
    avatar_url text,
    attachments jsonb
)
language sql
security definer
stable
as $$
    select
        m.id,
        m.channel_id,
        m.user_id,
        m.content,
        m.reply_to,
        m.reply_count,
        m.created_at,
        m.updated_at,
        u.username,
        u.avatar_url,
        m.attachments
    from messages m
    join users u on u.id = m.user_id
    where exists (
        select 1
        from messages thread_msg
        join channel_memberships cm on cm.channel_id = thread_msg.channel_id
        where thread_msg.id = thread_id
        and cm.user_id = auth.uid()
    )
    and (
        m.id = thread_id
        or m.reply_to = thread_id
    )
    order by m.created_at asc;
$$;

-- Create function to reply to messages
create or replace function public.create_thread_reply(
    thread_parent_id uuid,
    content text,
    p_attachments text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    channel_id_var uuid;
    new_message_id uuid;
    attachments_json jsonb;
begin
    -- Get channel ID and verify access in one step
    select m.channel_id into channel_id_var
    from messages m
    join channel_memberships cm on cm.channel_id = m.channel_id
    where m.id = thread_parent_id
    and cm.user_id = auth.uid();

    if channel_id_var is null then
        raise exception 'Access denied or parent message not found';
    end if;

    -- Convert comma-separated attachments to JSON array of objects
    if p_attachments is not null then
        select jsonb_agg(jsonb_build_object(
            'url', url,
            'filename', split_part(url, '/', -1)
        ))
        from unnest(string_to_array(p_attachments, ',')) as url
        into attachments_json;
    else
        attachments_json = '[]'::jsonb;
    end if;

    -- Insert the reply
    insert into messages (
        channel_id,
        user_id,
        content,
        reply_to,
        reply_count,
        attachments,
        created_at,
        updated_at
    ) values (
        channel_id_var,
        auth.uid(),
        content,
        thread_parent_id,
        0,
        attachments_json,
        now(),
        now()
    ) returning id into new_message_id;

    -- Update parent message reply count
    update messages
    set reply_count = reply_count + 1
    where id = thread_parent_id;

    return new_message_id;
end;
$$;

-- Grant execute permissions
grant execute on function public.get_thread_messages(uuid) to authenticated;
grant execute on function public.create_thread_reply(uuid, text, text) to authenticated;

-- Enable RLS
alter table public.messages enable row level security; 