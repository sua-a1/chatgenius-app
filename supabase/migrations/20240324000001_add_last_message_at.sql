-- Add last_message_at column to ai_assistant_conversations
alter table ai_assistant_conversations
add column if not exists last_message_at timestamptz default now() not null;

-- Create index for ordering
create index if not exists idx_ai_assistant_conversations_last_message_at 
on ai_assistant_conversations(workspace_id, last_message_at desc);

-- Create function to update last_message_at
create or replace function update_conversation_last_message_at()
returns trigger as $$
begin
    update ai_assistant_conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
    return new;
end;
$$ language plpgsql;

-- Create trigger
drop trigger if exists update_conversation_last_message_at_trigger on ai_assistant_messages;
create trigger update_conversation_last_message_at_trigger
    after insert on ai_assistant_messages
    for each row
    execute function update_conversation_last_message_at(); 