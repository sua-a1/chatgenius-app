-- Drop all mention-related triggers first
drop trigger if exists handle_direct_message_mentions on public.direct_messages;
drop trigger if exists handle_mentions on public.direct_messages;
drop trigger if exists handle_user_mentions on public.direct_messages;
drop trigger if exists handle_message_mentions on public.messages;
drop trigger if exists handle_mentions on public.messages;
drop trigger if exists handle_user_mentions on public.messages;

-- Drop all mention-related functions
drop function if exists public.handle_direct_message_mentions();
drop function if exists public.handle_mentions();
drop function if exists public.handle_user_mentions();
drop function if exists public.handle_message_mentions();

-- Drop all mention-related tables with cascade (this will also drop indexes, policies, etc.)
drop table if exists public.user_mentions cascade;
drop table if exists public.direct_message_mentions cascade;
drop table if exists public.message_mentions cascade;

-- Drop any remaining triggers that might reference mentions
do $$
declare
    trigger_record record;
begin
    for trigger_record in
        select tgname, relname
        from pg_trigger t
        join pg_class c on t.tgrelid = c.oid
        where tgname like '%mention%'
    loop
        execute format('drop trigger if exists %I on %I', trigger_record.tgname, trigger_record.relname);
    end loop;
end;
$$;

-- Drop any remaining functions that might reference mentions
do $$
declare
    func_record record;
begin
    for func_record in
        select proname
        from pg_proc
        where proname like '%mention%'
    loop
        execute format('drop function if exists public.%I() cascade', func_record.proname);
    end loop;
end;
$$; 