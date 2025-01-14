-- Create AI assistant tables
create table if not exists ai_assistant_conversations (
    id uuid primary key default uuid_generate_v4(),
    workspace_id uuid references workspaces(id) not null,
    user_id uuid references auth.users(id) not null,
    created_at timestamptz default now() not null
);

create table if not exists ai_assistant_messages (
    id uuid primary key default uuid_generate_v4(),
    conversation_id uuid references ai_assistant_conversations(id) not null,
    role text check (role in ('user', 'assistant')) not null,
    content text not null,
    created_at timestamptz default now() not null
);

-- Create indexes
create index if not exists idx_ai_assistant_conversations_workspace_user on ai_assistant_conversations(workspace_id, user_id);
create index if not exists idx_ai_assistant_messages_conversation on ai_assistant_messages(conversation_id);

-- Enable RLS
alter table ai_assistant_conversations enable row level security;
alter table ai_assistant_messages enable row level security;

-- Drop ALL existing policies first
do $$ 
begin
    execute (
        select string_agg(
            format('drop policy if exists %I on %I', 
                   policyname, tablename),
            '; ')
        from pg_policies 
        where schemaname = 'public' 
        and tablename in ('ai_assistant_conversations', 'ai_assistant_messages')
    );
end $$;

-- RLS Policies for ai_assistant_conversations
create policy "Users can view their own conversations in workspaces they belong to"
    on ai_assistant_conversations for select
    using (
        exists (
            select 1 from workspace_memberships
            where workspace_memberships.workspace_id = ai_assistant_conversations.workspace_id
            and workspace_memberships.user_id = auth.uid()
        )
    );

create policy "Users can create conversations in workspaces they belong to"
    on ai_assistant_conversations for insert
    with check (
        exists (
            select 1 from workspace_memberships
            where workspace_memberships.workspace_id = ai_assistant_conversations.workspace_id
            and workspace_memberships.user_id = auth.uid()
        )
        and auth.uid() = user_id
    );

create policy "Users can delete their own conversations"
    on ai_assistant_conversations for delete
    using (auth.uid() = user_id);

-- RLS Policies for ai_assistant_messages
create policy "Users can view messages from their conversations"
    on ai_assistant_messages for select
    using (
        exists (
            select 1 from ai_assistant_conversations ac
            join workspace_memberships wm 
            on ac.workspace_id = wm.workspace_id
            where ac.id = ai_assistant_messages.conversation_id
            and wm.user_id = auth.uid()
        )
    );

create policy "Users can insert messages to conversations in their workspaces"
    on ai_assistant_messages for insert
    with check (
        exists (
            select 1 from ai_assistant_conversations ac
            join workspace_memberships wm 
            on ac.workspace_id = wm.workspace_id
            where ac.id = conversation_id
            and wm.user_id = auth.uid()
        )
    );

-- Only system can delete messages (if needed in future)
create policy "Only system can delete messages"
    on ai_assistant_messages for delete
    using (false); 