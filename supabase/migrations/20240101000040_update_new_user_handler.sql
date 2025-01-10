-- Update the handle_new_user function to include created_at
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.users (id, email, username, created_at)
    values (
        new.id,
        new.email,
        new.raw_user_meta_data->>'username',
        new.created_at
    );
    return new;
end;
$$; 