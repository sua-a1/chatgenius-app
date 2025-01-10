-- Create buckets if they don't exist
insert into storage.buckets (id, name, public)
values 
  ('avatars', 'avatars', true),
  ('message-attachments', 'message-attachments', true),
  ('workspace-files', 'workspace-files', true)
on conflict (id) do nothing;

-- Policies for avatars bucket
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policies for message attachments bucket
create policy "Message attachments are accessible to workspace members"
  on storage.objects for select
  using (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.workspace_memberships
      where workspace_id = (storage.foldername(name))[1]::uuid
      and user_id = auth.uid()
    )
  );

create policy "Users can upload message attachments to their workspaces"
  on storage.objects for insert
  with check (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.workspace_memberships
      where workspace_id = (storage.foldername(name))[1]::uuid
      and user_id = auth.uid()
    )
  );

create policy "Users can delete their own message attachments"
  on storage.objects for delete
  using (
    bucket_id = 'message-attachments'
    and exists (
      select 1 from public.files
      where file_url like '%' || name
      and user_id = auth.uid()
    )
  );

-- Policies for workspace files bucket
create policy "Workspace files are accessible to workspace members"
  on storage.objects for select
  using (
    bucket_id = 'workspace-files'
    and exists (
      select 1 from public.workspace_memberships
      where workspace_id = (storage.foldername(name))[1]::uuid
      and user_id = auth.uid()
    )
  );

create policy "Users can upload workspace files to their workspaces"
  on storage.objects for insert
  with check (
    bucket_id = 'workspace-files'
    and exists (
      select 1 from public.workspace_memberships
      where workspace_id = (storage.foldername(name))[1]::uuid
      and user_id = auth.uid()
    )
  );

create policy "Users can delete their own workspace files"
  on storage.objects for delete
  using (
    bucket_id = 'workspace-files'
    and exists (
      select 1 from public.files
      where file_url like '%' || name
      and user_id = auth.uid()
    )
  ); 