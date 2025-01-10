-- Drop existing functions
drop function if exists public.get_thread_messages(uuid);
drop function if exists public.reply_to_message(uuid, text);
drop function if exists public.create_thread_reply(uuid, text);

-- Simple function to get thread messages
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
  user_username text,
  user_avatar_url text
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

-- Simple function to create a reply
create or replace function public.create_thread_reply(
  thread_parent_id uuid,
  message_content text
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
    message_content,
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

-- Grant execute permissions
grant execute on function public.get_thread_messages(uuid) to authenticated;
grant execute on function public.create_thread_reply(uuid, text) to authenticated; 