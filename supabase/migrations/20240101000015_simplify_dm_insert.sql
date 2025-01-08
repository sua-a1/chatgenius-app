-- Drop existing direct message policies
drop policy if exists "direct_messages_insert" on public.direct_messages;

-- Create simpler insert policy for direct messages
create policy "direct_messages_insert"
    on public.direct_messages
    for insert
    with check (
        -- Can only send messages as yourself
        sender_id = auth.uid()
        and
        -- Can only send to workspace members (including workspace owners)
        (workspace_id, receiver_id) in (
            select m.workspace_id, m.user_id
            from public.workspace_memberships m
            where m.workspace_id = workspace_id
            union
            select w.id, w.owner_id
            from public.workspaces w
            where w.id = workspace_id
        )
        and
        -- Must be a member or owner of the workspace yourself
        workspace_id in (
            select m.workspace_id
            from public.workspace_memberships m
            where m.user_id = auth.uid()
            union
            select w.id
            from public.workspaces w
            where w.owner_id = auth.uid()
        )
    ); 