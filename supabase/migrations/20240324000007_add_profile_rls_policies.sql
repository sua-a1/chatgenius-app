-- Enable RLS on the table
alter table ai_avatar_personality_profiles enable row level security;

-- Policy for reading profiles
create policy "Users can read profiles for avatars in their workspaces"
  on ai_avatar_personality_profiles
  for select
  using (
    exists (
      select 1 
      from workspace_members wm
      join ai_avatars aa on aa.workspace_id = wm.workspace_id
      where wm.user_id = auth.uid()
      and aa.id = ai_avatar_personality_profiles.avatar_id
    )
  );

-- Policy for inserting/updating profiles
create policy "Users can manage profiles for avatars in their workspaces"
  on ai_avatar_personality_profiles
  for all
  using (
    exists (
      select 1 
      from workspace_members wm
      join ai_avatars aa on aa.workspace_id = wm.workspace_id
      where wm.user_id = auth.uid()
      and aa.id = ai_avatar_personality_profiles.avatar_id
    )
  )
  with check (
    exists (
      select 1 
      from workspace_members wm
      join ai_avatars aa on aa.workspace_id = wm.workspace_id
      where wm.user_id = auth.uid()
      and aa.id = ai_avatar_personality_profiles.avatar_id
    )
  );

-- Grant access to authenticated users
grant all on ai_avatar_personality_profiles to authenticated; 