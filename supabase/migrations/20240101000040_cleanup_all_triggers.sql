-- Drop all non-system triggers on direct_messages table
do $$
declare
    trigger_record record;
begin
    for trigger_record in
        select tgname
        from pg_trigger t
        join pg_class c on t.tgrelid = c.oid
        where c.relname = 'direct_messages'
        and not tgisinternal -- exclude system triggers
        and tgname like any (array['%mention%', 'handle_%'])
    loop
        execute format('drop trigger if exists %I on public.direct_messages', trigger_record.tgname);
    end loop;
end;
$$;

-- Drop all non-system triggers on messages table
do $$
declare
    trigger_record record;
begin
    for trigger_record in
        select tgname
        from pg_trigger t
        join pg_class c on t.tgrelid = c.oid
        where c.relname = 'messages'
        and not tgisinternal -- exclude system triggers
        and tgname like any (array['%mention%', 'handle_%'])
    loop
        execute format('drop trigger if exists %I on public.messages', trigger_record.tgname);
    end loop;
end;
$$;

-- Drop all functions that might be related to mentions
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