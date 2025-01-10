-- Insert all existing users into user_presence table with offline status
insert into public.user_presence (user_id, status, last_seen, updated_at)
select 
    id as user_id,
    'offline'::text as status,
    now() as last_seen,
    now() as updated_at
from public.users
where not exists (
    select 1 
    from public.user_presence 
    where user_presence.user_id = users.id
); 