-- Enable RLS if not already enabled
alter table ai_assistant_conversations enable row level security;
alter table ai_assistant_messages enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Users can view their own conversations" on ai_assistant_conversations;
drop policy if exists "Users can create conversations" on ai_assistant_conversations;
drop policy if exists "Users can view messages in their conversations" on ai_assistant_messages;
drop policy if exists "Users can create messages in their conversations" on ai_assistant_messages;

-- Policies for conversations
create policy "Users can view their own conversations"
    on ai_assistant_conversations for select
    using (
        user_id = auth.uid() and
        exists (
            select 1 from workspace_memberships
            where workspace_memberships.workspace_id = ai_assistant_conversations.workspace_id
            and workspace_memberships.user_id = auth.uid()
        )
    );

create policy "Users can create conversations"
    on ai_assistant_conversations for insert
    with check (
        user_id = auth.uid() and
        exists (
            select 1 from workspace_memberships
            where workspace_memberships.workspace_id = ai_assistant_conversations.workspace_id
            and workspace_memberships.user_id = auth.uid()
        )
    );

-- Policies for messages
create policy "Users can view messages in their conversations"
    on ai_assistant_messages for select
    using (
        exists (
            select 1 from ai_assistant_conversations
            where ai_assistant_conversations.id = ai_assistant_messages.conversation_id
            and ai_assistant_conversations.user_id = auth.uid()
        )
    );

create policy "Users can create messages in their conversations"
    on ai_assistant_messages for insert
    with check (
        exists (
            select 1 from ai_assistant_conversations
            where ai_assistant_conversations.id = ai_assistant_messages.conversation_id
            and ai_assistant_conversations.user_id = auth.uid()
        )
    ); 