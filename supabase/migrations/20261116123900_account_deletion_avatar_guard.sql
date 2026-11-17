begin;

set local lock_timeout = '5s';
lock table auth.users, storage.objects in share row exclusive mode nowait;

do $$
begin
  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'avatars'
      and not exists (
        select 1 from auth.users u
        where u.id::text = (storage.foldername(o.name))[1]
      )
  ) then
    raise exception 'Existing avatar objects without an account need review';
  end if;
end;
$$;

create schema if not exists private;

-- Storage may perform the actual object write with a privileged role.
-- Lock the owner during that write, independently of API policy checks.
create or replace function private.require_live_avatar_owner()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner_prefix text := (storage.foldername(new.name))[1];
  owner_id uuid;
begin
  begin
    owner_id := owner_prefix::uuid;
  exception when invalid_text_representation then
    owner_id := null;
  end;

  perform 1 from auth.users u
  where u.id = owner_id and u.id::text = owner_prefix
  for key share;
  if not found then
    raise exception using
      errcode = '23503',
      message = 'Avatar objects require an existing account',
      hint = 'avatar_account_unavailable';
  end if;
  return new;
end;
$$;

-- Protect the legacy RPC and Auth administration through the same boundary.
create or replace function private.require_account_avatar_cleanup()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using
      errcode = '25001',
      message = 'Account removal requires a read committed transaction';
  end if;

  if exists (
    select 1 from storage.objects o
    where o.bucket_id = 'avatars'
      and (storage.foldername(o.name))[1] = old.id::text
  ) then
    raise exception using
      errcode = '23503',
      message = 'Remove account avatars before deleting the account',
      hint = 'account_avatar_cleanup_required';
  end if;
  return old;
end;
$$;

revoke all on function private.require_live_avatar_owner(),
  private.require_account_avatar_cleanup() from public, anon, authenticated, service_role;

create trigger auth_user_avatar_cleanup
before delete on auth.users
for each row execute function private.require_account_avatar_cleanup();

create trigger storage_avatar_live_owner
before insert or update of bucket_id, name on storage.objects
for each row when (new.bucket_id = 'avatars')
execute function private.require_live_avatar_owner();

-- Bind a multi-request cleanup to the account that started it.
create or replace function public.delete_own_account(p_expected_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_expected_user_id is null or p_expected_user_id is distinct from auth.uid() then
    raise exception using
      errcode = '42501',
      message = 'Account changed while deleting. Please try again.';
  end if;
  perform public.delete_own_account();
end;
$$;

revoke all on function public.delete_own_account(uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_own_account(uuid) to authenticated;

commit;
