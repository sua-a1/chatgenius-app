-- Create system user for AI assistant conversations
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'system@chatgenius.local',
  crypt('system-user-password', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"system"}',
  false,
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Insert into public.users table
INSERT INTO public.users (
  id,
  username,
  email,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system',
  'system@chatgenius.local',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING; 