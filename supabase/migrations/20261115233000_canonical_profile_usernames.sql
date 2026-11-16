-- Keep the existing UNIQUE(username) index and normalize before it is checked.
-- Existing data is inspected, never renamed by this migration.
begin;

set local lock_timeout = '5s';
lock table public.profiles in access exclusive mode nowait;

do $$
begin
  if exists (
    select 1 from public.profiles
    where username is null
       or username collate pg_catalog."C" !~ '^[a-z0-9._]{3,24}$'
  ) then
    raise exception 'Existing usernames need review before enforcing the canonical format';
  end if;
end;
$$;

create schema if not exists private;

create or replace function private.canonicalize_profile_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Fold ASCII letters only, independently of the database locale.
  new.username := pg_catalog.translate(
    pg_catalog.btrim(new.username, E' \t\n\r\f\013'),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'
  );
  return new;
end;
$$;

revoke all on function private.canonicalize_profile_username()
  from public, anon, authenticated, service_role;

create trigger profiles_canonical_username
before insert or update of username on public.profiles
for each row execute function private.canonicalize_profile_username();

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_canonical
    check (username collate pg_catalog."C" ~ '^[a-z0-9._]{3,24}$');

create or replace function public.check_username_available(target_username text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text := pg_catalog.translate(
    pg_catalog.btrim(target_username, E' \t\n\r\f\013'),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'
  );
begin
  if normalized_username is null
     or normalized_username collate pg_catalog."C" !~ '^[a-z0-9._]{3,24}$' then
    return false;
  end if;

  return not exists (
    select 1 from public.profiles where username = normalized_username
  );
end;
$$;

revoke all on function public.check_username_available(text) from public;
grant execute on function public.check_username_available(text) to anon, authenticated;

comment on function public.check_username_available(text) is
  'Signup-safe availability for canonical 3..24-character ASCII usernames; no profile fields returned.';

commit;
