-- Drop any existing policies on direct_messages
drop policy if exists "direct_messages_select" on public.direct_messages;
drop policy if exists "direct_messages_insert" on public.direct_messages;
drop policy if exists "direct_messages_update" on public.direct_messages;
drop policy if exists "direct_messages_delete" on public.direct_messages;

-- Enable RLS
alter table public.direct_messages enable row level security;

-- Create simple policies for direct messages
create policy "direct_messages_select"
    on public.direct_messages
    for select
    using (
        -- Can read messages where user is sender or receiver
        sender_id = auth.uid()
        or
        receiver_id = auth.uid()
    );

create policy "direct_messages_insert"
    on public.direct_messages
    for insert
    with check (
        -- Can only send messages as yourself
        sender_id = auth.uid()
        and
        -- Can only send to workspace members
        exists (
            select 1 from public.workspaces w
            where w.id = workspace_id
            and (
                w.owner_id = auth.uid()
                or
                exists (
                    select 1 from public.workspace_memberships m
                    where m.workspace_id = w.id
                    and m.user_id = auth.uid()
                )
            )
        )
    );

create policy "direct_messages_update"
    on public.direct_messages
    for update
    using (
        -- Can only update own messages
        sender_id = auth.uid()
    );

create policy "direct_messages_delete"
    on public.direct_messages
    for delete
    using (
        -- Can only delete own messages
        sender_id = auth.uid()
    ); 