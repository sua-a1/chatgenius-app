-- Create helper function to check workspace membership
create or replace function public.can_access_workspace(workspace_id uuid, user_id uuid)
returns boolean
language sql
security definer
stable
as $$
    select exists (
        select 1
        from public.workspace_memberships m
        where m.workspace_id = $1
        and m.user_id = $2
    )
    or exists (
        select 1
        from public.workspaces w
        where w.id = $1
        and w.owner_id = $2
    );
$$;

-- Drop existing direct message policies
drop policy if exists "direct_messages_insert" on public.direct_messages;

-- Create extremely simple insert policy for direct messages
create policy "direct_messages_insert"
    on public.direct_messages
    for insert
    with check (
        -- Can only send messages as yourself
        sender_id = auth.uid()
        and
        -- Both sender and receiver must be workspace members
        public.can_access_workspace(workspace_id, auth.uid())
        and
        public.can_access_workspace(workspace_id, receiver_id)
    ); 