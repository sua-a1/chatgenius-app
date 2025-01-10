-- Update messages table to ensure all required fields have defaults
alter table public.messages 
  alter column reply_to set default null,
  alter column reply_count set default 0,
  alter column updated_at set default timezone('utc'::text, now());

-- Update the reply_to_message function to set all required fields
create or replace function public.reply_to_message(
  thread_id uuid,
  content text
)
returns uuid
language plpgsql
security definer
as $$
declare
  channel_id_var uuid;
  new_message_id uuid;
begin
  -- Get the channel_id from the parent message
  select channel_id into channel_id_var
  from public.messages
  where id = thread_id;

  if channel_id_var is null then
    raise exception 'Parent message not found';
  end if;

  -- Check if user has access to the channel
  if not exists (
    select 1 from public.channel_memberships
    where channel_id = channel_id_var
    and user_id = auth.uid()
  ) then
    raise exception 'Access denied';
  end if;

  -- Insert the reply with all required fields
  insert into public.messages (
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
    thread_id,
    0,
    now(),
    now()
  )
  returning id into new_message_id;

  return new_message_id;
end;
$$;

-- Update existing messages to ensure reply_count is set
update public.messages
set reply_count = 0
where reply_count is null; 