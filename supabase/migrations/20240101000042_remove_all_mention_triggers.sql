-- Drop all mention-related triggers
do $$
declare
    trigger_record record;
begin
    -- Get all triggers that have 'mention' in their name or are related to mentions
    for trigger_record in
        select distinct t.tgname, c.relname
        from pg_trigger t
        join pg_class c on t.tgrelid = c.oid
        join pg_namespace n on c.relnamespace = n.oid
        where n.nspname = 'public'
        and not t.tgisinternal
        and (
            t.tgname like '%mention%'
            or t.tgname like 'handle_%'
            or c.relname like '%mention%'
        )
    loop
        execute format('drop trigger if exists %I on public.%I', trigger_record.tgname, trigger_record.relname);
    end loop;
end;
$$;

-- Drop all mention-related functions
do $$
declare
    func_record record;
begin
    -- Get all functions that have 'mention' in their name or are related to mentions
    for func_record in
        select distinct p.proname
        from pg_proc p
        join pg_namespace n on p.pronamespace = n.oid
        where n.nspname = 'public'
        and (
            p.proname like '%mention%'
            or p.proname like 'handle_%'
        )
    loop
        execute format('drop function if exists public.%I() cascade', func_record.proname);
    end loop;
end;
$$;

-- Drop all mention-related tables
drop table if exists public.user_mentions cascade;
drop table if exists public.direct_message_mentions cascade;
drop table if exists public.message_mentions cascade;

-- Drop all mention-related views
drop view if exists public.user_mentions_with_users cascade;
drop view if exists public.direct_message_mentions_with_users cascade;
drop view if exists public.message_mentions_with_users cascade; 