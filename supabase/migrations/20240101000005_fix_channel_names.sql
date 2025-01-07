-- First, update existing channel names to remove any UUIDs
update public.channels
set name = regexp_replace(name, ' [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', '');

-- Add a trigger to prevent UUIDs from being appended to channel names
create or replace function public.clean_channel_name()
returns trigger as $$
begin
  -- Remove any UUID-like patterns from the end of the name
  new.name = regexp_replace(new.name, ' [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', '');
  return new;
end;
$$ language plpgsql;

create trigger clean_channel_name_trigger
before insert or update on public.channels
for each row execute function public.clean_channel_name(); 