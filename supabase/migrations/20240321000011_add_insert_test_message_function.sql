-- Create a function to insert test messages
create or replace function insert_test_message(
  p_content text,
  p_channel_id uuid,
  p_user_id uuid
) returns uuid as $$
declare
  v_message_id uuid;
begin
  insert into messages (
    content,
    channel_id,
    user_id,
    reply_to,
    reply_count,
    attachments,
    created_at,
    updated_at
  ) values (
    p_content,
    p_channel_id,
    p_user_id,
    null,
    0,
    '[]',
    now(),
    now()
  ) returning id into v_message_id;

  return v_message_id;
end;
$$ language plpgsql security definer; 