-- First, disable RLS completely
alter table storage.objects disable row level security;
alter table storage.buckets disable row level security;

-- Drop ALL existing policies
drop policy if exists "Users can upload files" on storage.objects;
drop policy if exists "Public can read files" on storage.objects;
drop policy if exists "Users can delete their own files" on storage.objects;
drop policy if exists "authenticated_upload" on storage.objects;
drop policy if exists "public_read" on storage.objects;
drop policy if exists "authenticated_delete" on storage.objects;
drop policy if exists "allow_authenticated_uploads" on storage.objects;
drop policy if exists "allow_public_reads" on storage.objects;
drop policy if exists "allow_authenticated_deletes" on storage.objects;
drop policy if exists "public_select" on storage.objects;
drop policy if exists "authenticated_insert" on storage.objects;
drop policy if exists "authenticated_update" on storage.objects;
drop policy if exists "authenticated_delete" on storage.objects;
drop policy if exists "allow_public_select" on storage.objects;
drop policy if exists "allow_auth_insert" on storage.objects;
drop policy if exists "allow_auth_update" on storage.objects;
drop policy if exists "allow_auth_delete" on storage.objects;

-- Drop and recreate the bucket
delete from storage.objects where bucket_id = 'chat_attachments';
delete from storage.buckets where id = 'chat_attachments';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat_attachments',
  'chat_attachments',
  true,
  52428800, -- 50MB
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
);

-- Grant full access to authenticated users
grant all privileges on storage.buckets to authenticated;
grant all privileges on storage.objects to authenticated;
grant usage on schema storage to authenticated;

-- Grant read access to public (anonymous) users
grant usage on schema storage to anon;
grant select on storage.buckets to anon;
grant select on storage.objects to anon; 