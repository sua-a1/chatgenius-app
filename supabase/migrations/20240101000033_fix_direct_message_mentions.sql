-- Drop any existing triggers for direct message mentions
drop trigger if exists handle_direct_message_mentions on public.direct_messages;
drop function if exists public.handle_direct_message_mentions();

-- Create function to handle direct message mentions
create or replace function public.handle_direct_message_mentions()
returns trigger
language plpgsql
security definer
as $$
declare
    mention_match text;
    mentioned_user_id uuid;
begin
    -- Extract mentions from message content (e.g., @username)
    for mention_match in
        select regexp_matches(NEW.message, '@(\w+)', 'g')
    loop
        -- Find the user ID for the mentioned username
        select id into mentioned_user_id
        from public.users
        where username = mention_match[1];

        if mentioned_user_id is not null then
            -- Insert into direct_message_mentions
            insert into public.direct_message_mentions (direct_message_id, user_id)
            values (NEW.id, mentioned_user_id)
            on conflict (direct_message_id, user_id) do nothing;
        end if;
    end loop;

    return NEW;
end;
$$;

-- Create trigger for direct message mentions
create trigger handle_direct_message_mentions
    after insert on public.direct_messages
    for each row
    execute function public.handle_direct_message_mentions(); 