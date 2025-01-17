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
  similarity float,
  subject_group text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  workspace_id_param uuid;
  effective_limit int;
  target_username text;
  target_channel text;
  comparison_subjects jsonb;
  is_comparison boolean;
  topic_search boolean;
  topic_query text;
  similarity_threshold float;
begin
  -- Extract workspace_id from filter
  workspace_id_param := (filter->>'workspace_id')::uuid;
  
  -- Extract comparison info if present
  comparison_subjects := filter->'comparison_subjects';
  is_comparison := comparison_subjects is not null and 
                  (jsonb_array_length(comparison_subjects->'users') > 0 or 
                   jsonb_array_length(comparison_subjects->'channels') > 0);
  
  -- Extract topic search info
  topic_search := filter->>'topic' is not null;
  topic_query := filter->>'topic';
  
  -- Extract user and channel filters
  target_username := filter->>'username';
  target_channel := filter->>'channel_name';

  -- Set similarity threshold based on query type
  similarity_threshold := case
    when topic_search and (target_username is not null or target_channel is not null) then
      0.5  -- More lenient for combined topic + user/channel searches
    when topic_search then
      0.6  -- Lenient for topic-only searches
    else
      0.7  -- Default threshold
  end;

  -- Require workspace_id
  if workspace_id_param is null then
    raise exception 'workspace_id is required in filter';
  end if;

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

  -- Determine effective limit based on query type and filters
  effective_limit := case
    when is_comparison then
      greatest(match_count * 3, 150)  -- Take more results for comparison
    when topic_search then
      case
        when target_username is not null and target_channel is not null then
          greatest(match_count * 4, 200)  -- More results for combined user+channel+topic
        when target_username is not null or target_channel is not null then
          greatest(match_count * 3, 150)  -- More results for user/channel+topic
        else
          greatest(match_count * 2, 100)  -- Base topic search
      end
    when target_username is not null or target_channel is not null then
      greatest(match_count * 2, 100)  -- More results for user/channel queries
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
      case
        when is_comparison then
          case
            when comparison_subjects->'users' ? u.username then u.username::text
            when comparison_subjects->'channels' ? c.name then c.name::text
            else 'other'
          end
        else
          case 
            -- Combined user+channel grouping
            when target_username is not null and target_channel is not null then
              concat(u.username, ':', c.name)::text
            -- Individual grouping
            when target_channel is not null then c.name::text
            when target_username is not null then u.username::text
            else 'default'
          end
      end as group_key,
      row_number() over (
        partition by 
          case
            when is_comparison then
              case
                when comparison_subjects->'users' ? u.username then u.username::text
                when comparison_subjects->'channels' ? c.name then c.name::text
                else 'other'
              end
            -- Combined user+channel partitioning
            when target_username is not null and target_channel is not null then
              concat(u.username, ':', c.name)::text
            -- Individual partitioning
            when target_channel is not null then c.name::text
            when target_username is not null then u.username::text
            else null::text
          end
        order by 
          case 
            when topic_search then
              -- Boost messages that explicitly mention the topic
              case 
                when m.content ilike '%' || topic_query || '%' then 3
                when m.content ~* concat('\y', topic_query, '\y') then 2
                else 1
              end * (1 - (me.embedding <=> query_embedding))
            else
              1 - (me.embedding <=> query_embedding)
          end desc
      ) as rank_in_group,
      case 
        when topic_search then
          case 
            when m.content ilike '%' || topic_query || '%' then 3
            when m.content ~* concat('\y', topic_query, '\y') then 2
            else 1
          end * (1 - (me.embedding <=> query_embedding))
        else
          1 - (me.embedding <=> query_embedding)
      end as adjusted_similarity
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
      -- Apply comparison filters if present
      and case
        when is_comparison then
          (comparison_subjects->'users' ? u.username or
           comparison_subjects->'channels' ? c.name)
        else true
      end
      -- Apply channel filter if provided
      and case
        when target_channel is not null then
          lower(c.name) = lower(target_channel)
        else true
      end
      -- Apply user filter if provided
      and case
        when target_username is not null then
          lower(u.username) = lower(target_username)
        else true
      end
      -- Apply topic filter if provided
      and case
        when topic_search then
          -- Include messages that are semantically similar to the topic
          -- or explicitly mention it
          (1 - (me.embedding <=> query_embedding)) > similarity_threshold or
          m.content ilike '%' || topic_query || '%' or
          m.content ~* concat('\y', topic_query, '\y')
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
    adjusted_similarity as similarity,
    group_key as subject_group
  from ranked_messages
  where
    -- For comparison/channel/user queries, take more messages per group
    case 
      when is_comparison or target_channel is not null or target_username is not null then
        rank_in_group <= effective_limit
      else
        true
    end
  order by 
    case when is_comparison then group_key end nulls last,
    adjusted_similarity desc
  limit effective_limit;
end;
$function$; 