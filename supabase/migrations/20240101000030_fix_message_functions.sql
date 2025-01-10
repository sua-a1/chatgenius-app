-- Drop existing functions and triggers
drop function if exists public.get_thread_messages(uuid);
drop function if exists public.reply_to_message(uuid, text);
drop function if exists public.create_thread_reply(uuid, text);
drop trigger if exists update_message_reply_count on public.messages;
drop function if exists public.update_message_reply_count();

-- Recreate the get_thread_messages function
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
  avatar_url text
)
language sql
security definer
set search_path = public
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
    u.username::text,
    u.avatar_url::text
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

-- Recreate the create_thread_reply function
create or replace function public.create_thread_reply(
  thread_parent_id uuid,
  content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  channel_id_var uuid;
  new_message_id uuid;
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

  -- Insert the reply
  insert into messages (
    channel_id,
    user_id,
    content,
    reply_to,
    reply_count,
    created_at,
    updated_at
  ) values (
    channel_id_var,
    auth.uid(),
    content,
    thread_parent_id,
    0,
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

-- Recreate the update_message_reply_count function and trigger
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

create trigger update_message_reply_count
  after insert or delete on public.messages
  for each row
  execute function public.update_message_reply_count();

-- Grant execute permissions
grant execute on function public.get_thread_messages(uuid) to authenticated;
grant execute on function public.create_thread_reply(uuid, text) to authenticated;

-- Drop and recreate message policies to ensure consistency
drop policy if exists "Users can view messages in channels they are members of" on public.messages;
drop policy if exists "Users can create messages in channels they are members of" on public.messages;
drop policy if exists "Users can update their own messages" on public.messages;

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
  );

create policy "Users can update their own messages"
  on public.messages for update
  using (user_id = auth.uid());

create policy "Users can delete their own messages"
  on public.messages for delete
  using (user_id = auth.uid()); 