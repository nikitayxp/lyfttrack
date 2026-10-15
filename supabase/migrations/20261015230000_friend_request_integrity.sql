begin;

create or replace function public.prevent_friend_request_identity_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
     or new.from_user_id is distinct from old.from_user_id
     or new.to_user_id is distinct from old.to_user_id then
    raise exception 'Friend request participants and identity cannot be changed.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_friend_request_identity_change() from public;

drop trigger if exists trg_friend_request_identity on public.friend_requests;
create trigger trg_friend_request_identity
before update on public.friend_requests
for each row execute function public.prevent_friend_request_identity_change();

drop policy if exists friend_requests_update_recipient on public.friend_requests;
create policy friend_requests_update_recipient
on public.friend_requests
for update
to authenticated
using (auth.uid() = to_user_id and status = 'pending')
with check (auth.uid() = to_user_id and status in ('accepted', 'rejected'));

drop policy if exists friends_insert_from_incoming_request on public.friends;
revoke insert on public.friends from public, anon, authenticated;

alter function public.respond_to_friend_request(uuid, text) security definer;
alter function public.respond_to_friend_request(uuid, text) set search_path = public, pg_temp;
revoke all on function public.respond_to_friend_request(uuid, text) from public, anon;
grant execute on function public.respond_to_friend_request(uuid, text) to authenticated;

commit;
