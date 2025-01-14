-- Add a unique constraint for message content and channel_id
alter table messages
add constraint messages_content_channel_unique unique (content, channel_id); 