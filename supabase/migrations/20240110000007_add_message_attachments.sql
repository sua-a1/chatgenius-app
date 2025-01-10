-- Add attachments array to messages
alter table public.messages
add column attachments jsonb default '[]'::jsonb;

-- Add attachments array to direct_messages
alter table public.direct_messages
add column attachments jsonb default '[]'::jsonb;

-- Update message functions and triggers
create or replace function public.send_message(
  p_content text,
  p_channel_id uuid,
  p_attachments text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_message_id uuid;
  v_attachments_array jsonb;
begin
  -- Parse attachments string into JSON array if provided
  if p_attachments is not null then
    v_attachments_array = (
      select jsonb_agg(jsonb_build_object(
        'url', url,
        'filename', split_part(url, '/', -1)
      ))
      from unnest(string_to_array(p_attachments, ',')) as url
    );
  else
    v_attachments_array = '[]'::jsonb;
  end if;

  insert into public.messages (
    content,
    channel_id,
    user_id,
    attachments
  )
  values (
    p_content,
    p_channel_id,
    auth.uid(),
    v_attachments_array
  )
  returning id into v_message_id;

  return v_message_id;
end;
$$;

-- Update direct message functions
create or replace function public.send_direct_message(
  p_content text,
  p_receiver_id uuid,
  p_workspace_id uuid,
  p_attachments text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_message_id uuid;
  v_attachments_array jsonb;
begin
  -- Parse attachments string into JSON array if provided
  if p_attachments is not null then
    v_attachments_array = (
      select jsonb_agg(jsonb_build_object(
        'url', url,
        'filename', split_part(url, '/', -1)
      ))
      from unnest(string_to_array(p_attachments, ',')) as url
    );
  else
    v_attachments_array = '[]'::jsonb;
  end if;

  insert into public.direct_messages (
    message,
    sender_id,
    receiver_id,
    workspace_id,
    attachments
  )
  values (
    p_content,
    auth.uid(),
    p_receiver_id,
    p_workspace_id,
    v_attachments_array
  )
  returning id into v_message_id;

  return v_message_id;
end;
$$; 