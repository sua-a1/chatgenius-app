-- Drop existing policies
drop policy if exists "Users can upload files" on public.files;
drop policy if exists "Users can read files they have access to" on public.files;

-- Enable RLS
alter table public.files enable row level security;

-- Create insert policy that allows authenticated users to upload files
create policy "Users can upload files"
on public.files
for insert
with check (
  -- User must be authenticated
  auth.uid() = user_id
  and
  -- User must be a member of the workspace
  exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = files.workspace_id
    and wm.user_id = auth.uid()
  )
  and
  -- For channel files, user must be a member of the channel if it's private
  (
    channel_id is null
    or
    exists (
      select 1 from public.channels c
      left join public.channel_memberships cm on cm.channel_id = c.id and cm.user_id = auth.uid()
      where c.id = files.channel_id
      and c.workspace_id = files.workspace_id
      and (
        not c.is_private -- Allow if channel is public
        or cm.user_id is not null -- Or if user is a member
      )
    )
  )
);

-- Create read policy that allows workspace members to read files
create policy "Users can read files they have access to"
on public.files
for select
using (
  -- User must be a member of the workspace
  exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = files.workspace_id
    and wm.user_id = auth.uid()
  )
  and
  -- For channel files, allow access if channel is public or user is a member
  (
    channel_id is null
    or
    exists (
      select 1 from public.channels c
      left join public.channel_memberships cm on cm.channel_id = c.id and cm.user_id = auth.uid()
      where c.id = files.channel_id
      and c.workspace_id = files.workspace_id
      and (
        not c.is_private -- Allow if channel is public
        or cm.user_id is not null -- Or if user is a member
      )
    )
  )
); 