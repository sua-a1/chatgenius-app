-- Add policies for updating and deleting direct messages
create policy "Users can update their own direct messages"
    on public.direct_messages for update
    using (auth.uid() = sender_id);

create policy "Users can delete their own direct messages"
    on public.direct_messages for delete
    using (auth.uid() = sender_id); 