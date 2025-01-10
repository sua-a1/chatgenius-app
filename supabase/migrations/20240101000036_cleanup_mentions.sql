-- Drop all triggers first
drop trigger if exists handle_direct_message_mentions on public.direct_messages;
drop trigger if exists handle_mentions on public.direct_messages;
drop trigger if exists handle_user_mentions on public.direct_messages;
drop trigger if exists handle_message_mentions on public.messages;

-- Drop all mention-related functions
drop function if exists public.handle_direct_message_mentions();
drop function if exists public.handle_mentions();
drop function if exists public.handle_user_mentions();
drop function if exists public.handle_message_mentions();

-- Drop indexes
drop index if exists public.idx_user_mentions_message_id;
drop index if exists public.idx_user_mentions_user_id;
drop index if exists public.idx_direct_message_mentions_message_id;
drop index if exists public.idx_direct_message_mentions_user_id;

-- Drop policies
drop policy if exists "Users can view mentions in their direct messages" on public.direct_message_mentions;
drop policy if exists "Users can create mentions in their direct messages" on public.direct_message_mentions;
drop policy if exists "Users can view mentions" on public.user_mentions;
drop policy if exists "Users can create mentions" on public.user_mentions;

-- Drop tables (this will also drop any remaining dependent objects)
drop table if exists public.user_mentions cascade;
drop table if exists public.direct_message_mentions cascade; 