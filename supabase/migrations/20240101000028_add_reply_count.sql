-- Add reply_count column to messages
alter table public.messages add column if not exists reply_count integer default 0;

-- Create function to update reply count
create or replace function public.update_message_reply_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'INSERT' then
    -- Increment reply count of parent message
    if NEW.reply_to is not null then
      update public.messages
      set reply_count = reply_count + 1
      where id = NEW.reply_to;
    end if;
  elsif TG_OP = 'DELETE' then
    -- Decrement reply count of parent message
    if OLD.reply_to is not null then
      update public.messages
      set reply_count = greatest(0, reply_count - 1)
      where id = OLD.reply_to;
    end if;
  end if;
  return null;
end;
$$;

-- Create trigger for reply count updates
drop trigger if exists update_message_reply_count on public.messages;
create trigger update_message_reply_count
  after insert or delete on public.messages
  for each row
  execute function public.update_message_reply_count();

-- Update existing reply counts
with reply_counts as (
  select reply_to, count(*) as count
  from public.messages
  where reply_to is not null
  group by reply_to
)
update public.messages m
set reply_count = rc.count
from reply_counts rc
where m.id = rc.reply_to; 