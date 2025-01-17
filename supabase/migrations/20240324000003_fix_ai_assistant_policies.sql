-- Drop existing policies
drop policy if exists "Users can view their own conversations" on ai_assistant_conversations;
drop policy if exists "Users can create conversations" on ai_assistant_conversations;
drop policy if exists "Users can view messages in their conversations" on ai_assistant_messages;
drop policy if exists "Users can create messages in their conversations" on ai_assistant_messages;

-- Policies for conversations with explicit workspace checks
create policy "Users can view their own conversations in their workspaces"
    on ai_assistant_conversations for select
    using (
        user_id = auth.uid() and
        exists (
            select 1 from workspace_memberships
            where workspace_memberships.workspace_id = ai_assistant_conversations.workspace_id
            and workspace_memberships.user_id = auth.uid()
        )
    );

create policy "Users can create conversations in their workspaces"
    on ai_assistant_conversations for insert
    with check (
        user_id = auth.uid() and
        exists (
            select 1 from workspace_memberships
            where workspace_memberships.workspace_id = ai_assistant_conversations.workspace_id
            and workspace_memberships.user_id = auth.uid()
        )
    );

-- Policies for messages with explicit workspace checks
create policy "Users can view messages in their workspace conversations"
    on ai_assistant_messages for select
    using (
        exists (
            select 1 from ai_assistant_conversations ac
            join workspace_memberships wm on wm.workspace_id = ac.workspace_id
            where ac.id = ai_assistant_messages.conversation_id
            and wm.user_id = auth.uid()
            and ac.user_id = auth.uid()
        )
    );

create policy "Users can create messages in their workspace conversations"
    on ai_assistant_messages for insert
    with check (
        exists (
            select 1 from ai_assistant_conversations ac
            join workspace_memberships wm on wm.workspace_id = ac.workspace_id
            where ac.id = conversation_id
            and wm.user_id = auth.uid()
            and ac.user_id = auth.uid()
        )
    ); 