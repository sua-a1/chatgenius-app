-- Drop everything first
drop policy if exists "channels_select" on public.channels;
drop policy if exists "channels_insert" on public.channels;
drop policy if exists "channels_update" on public.channels;
drop policy if exists "channel_read" on public.channels;
drop policy if exists "channel_write" on public.channels;
drop policy if exists "channel_member_read" on public.channel_memberships;
drop policy if exists "channel_member_write" on public.channel_memberships;
drop policy if exists "channel_memberships_select" on public.channel_memberships;
drop policy if exists "channel_memberships_insert" on public.channel_memberships;
drop policy if exists "channel_memberships_delete" on public.channel_memberships;
drop policy if exists "workspace_member_channels_access" on public.channels;
drop policy if exists "own_channel_memberships_access" on public.channel_memberships;
drop policy if exists "manage_avatar_profiles" on ai_avatar_personality_profiles;

-- Drop existing functions
drop function if exists get_channel_data;
drop function if exists get_channel_workspace_id;
drop function if exists upsert_avatar_profile;

-- Create function to get workspace_id
create or replace function get_channel_workspace_id(p_channel_id uuid)
returns uuid
language sql
security definer
as $$
    select workspace_id 
    from public.channels 
    where id = p_channel_id;
$$;

-- Add unique constraint for avatar_id if it doesn't exist
do $$ 
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'ai_avatar_personality_profiles_avatar_id_key'
    ) then
        alter table ai_avatar_personality_profiles
            add constraint ai_avatar_personality_profiles_avatar_id_key unique (avatar_id);
    end if;
end $$;

-- Create secure function to handle profile updates
create or replace function upsert_avatar_profile(
    p_avatar_id uuid,
    p_workspace_id uuid,
    p_message_categories jsonb,
    p_linguistic_patterns jsonb,
    p_style_overrides jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_result jsonb;
begin
    -- Check if user has access to the workspace
    if not exists (
        select 1 
        from public.workspace_memberships wm
        where wm.workspace_id = p_workspace_id
        and wm.user_id = auth.uid()
    ) then
        raise exception 'Access denied to workspace';
    end if;

    -- Check if avatar belongs to workspace
    if not exists (
        select 1 
        from public.ai_avatars aa
        where aa.id = p_avatar_id
        and aa.workspace_id = p_workspace_id
    ) then
        raise exception 'Avatar does not belong to workspace';
    end if;

    -- Perform the upsert
    insert into ai_avatar_personality_profiles (
        avatar_id,
        workspace_id,
        message_categories,
        linguistic_patterns,
        style_overrides,
        created_at,
        last_updated
    )
    values (
        p_avatar_id,
        p_workspace_id,
        p_message_categories,
        p_linguistic_patterns,
        p_style_overrides,
        now(),
        now()
    )
    on conflict (avatar_id) do update set
        message_categories = p_message_categories,
        linguistic_patterns = p_linguistic_patterns,
        style_overrides = p_style_overrides,
        last_updated = now()
    returning to_jsonb(ai_avatar_personality_profiles.*) into v_result;

    return v_result;
end;
$$; 