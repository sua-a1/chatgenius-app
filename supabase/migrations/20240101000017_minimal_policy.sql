-- Drop all existing policies
drop policy if exists "direct_messages_insert" on public.direct_messages;
drop policy if exists "direct_messages_select" on public.direct_messages;
drop policy if exists "direct_messages_update" on public.direct_messages;
drop policy if exists "direct_messages_delete" on public.direct_messages;

-- Create minimal policies
create policy "direct_messages_select"
    on public.direct_messages
    for select
    using (
        sender_id = auth.uid()
        or
        receiver_id = auth.uid()
    );

create policy "direct_messages_insert"
    on public.direct_messages
    for insert
    with check (sender_id = auth.uid());

create policy "direct_messages_update"
    on public.direct_messages
    for update
    using (sender_id = auth.uid());

create policy "direct_messages_delete"
    on public.direct_messages
    for delete
    using (sender_id = auth.uid()); 