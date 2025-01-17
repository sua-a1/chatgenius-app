-- Drop all existing function signatures
drop function if exists search_messages(vector, jsonb, int);
drop function if exists search_messages(vector, uuid, jsonb, int);
drop function if exists search_messages(vector, jsonb, int, jsonb);
drop function if exists search_messages(vector, uuid, int);
drop function if exists search_messages(vector, uuid, int, float);

-- Create a function to search messages using vector similarity
create or replace function search_messages(
  query_embedding vector(1536),
  filter jsonb default '{}',
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  workspace_id_param uuid;
  effective_limit int;
  target_username text;
begin
  -- Extract workspace_id from filter
  workspace_id_param := (filter->>'workspace_id')::uuid;
  
  -- Require workspace_id
  if workspace_id_param is null then
    raise exception 'workspace_id is required in filter';
  end if;

  -- Extract username if provided
  target_username := filter->>'username';

  -- Skip workspace access check for service role
  if auth.role() <> 'service_role' then
    -- Verify workspace access for current user (auth.uid())
    if not exists (
      select 1 
      from workspace_memberships wm
      where wm.workspace_id = workspace_id_param
      and wm.user_id = auth.uid()
    ) then
      raise exception 'Access denied to workspace';
    end if;
  end if;

  -- Determine effective limit based on whether it's a channel or user query
  effective_limit := case
    when filter->>'channel_name' is not null or target_username is not null then
      greatest(match_count, 100)  -- Use at least 100 for channel/user queries
    else
      match_count
  end;

  return query
  with ranked_messages as (
    select
      m.id as message_id,
      m.content as message_content,
      jsonb_build_object(
        'workspace_id', c.workspace_id,
        'channel_id', m.channel_id,
        'channel_name', c.name,
        'created_at', m.created_at,
        'user_id', m.user_id,
        'username', coalesce(u.username, ''),
        'full_name', coalesce(u.full_name, ''),
        'user_email', coalesce(u.email, ''),
        'user_avatar_url', coalesce(u.avatar_url, ''),
        'version', me.version,
        'is_latest', me.is_latest,
        'is_deleted', me.is_deleted,
        'original_message_content', me.original_message_content
      ) as message_metadata,
      1 - (me.embedding <=> query_embedding) as message_similarity,
      row_number() over (
        partition by 
          case 
            when filter->>'channel_name' is not null then m.channel_id 
            when target_username is not null then m.user_id
            else null 
          end
        order by me.embedding <=> query_embedding
      ) as rank_in_group
    from
      messages m
      inner join channels c on c.id = m.channel_id
      inner join message_embeddings me on m.id = me.message_id
      left join users u on u.id = m.user_id
    where
      -- Enforce workspace filter
      c.workspace_id = workspace_id_param
      -- Skip channel access check for service role
      and (
        auth.role() = 'service_role'
        or exists (
          select 1 
          from workspace_memberships wm
          where wm.workspace_id = c.workspace_id
          and wm.user_id = auth.uid()
          and (
            not c.is_private 
            or exists (
              select 1 
              from channel_memberships cm
              where cm.channel_id = c.id
              and cm.user_id = auth.uid()
            )
          )
        )
      )
      -- Apply channel filter if provided
      and case
        when filter->>'channel_name' is not null then
          lower(c.name) = lower(filter->>'channel_name')
        else true
      end
      -- Apply user filter if provided
      and case
        when target_username is not null then
          lower(u.username) = lower(target_username)
        else true
      end
      -- Only return latest, non-deleted messages
      and me.is_latest = true
      and me.is_deleted = false
      -- Apply date range filter if provided
      and case
        when filter->>'created_at_gte' is not null then
          m.created_at >= (filter->>'created_at_gte')::timestamptz
        else true
      end
      and case
        when filter->>'created_at_lte' is not null then
          m.created_at <= (filter->>'created_at_lte')::timestamptz
        else true
      end
  )
  select
    message_id as id,
    message_content as content,
    message_metadata as metadata,
    message_similarity as similarity
  from ranked_messages
  where
    -- For channel/user queries, take more messages per group
    case 
      when filter->>'channel_name' is not null or target_username is not null then
        rank_in_group <= effective_limit
      else
        true
    end
  order by message_similarity desc
  limit effective_limit;
end;
$function$; 