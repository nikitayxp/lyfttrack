-- issue #138: removing a friend was impossible from the client. friends had
-- select and insert policies but no delete, so the delete affected no rows and
-- reported no error.
drop policy if exists friends_delete_own on public.friends;

create policy friends_delete_own
  on public.friends for delete to authenticated
  using (auth.uid() = user_low_id or auth.uid() = user_high_id);
