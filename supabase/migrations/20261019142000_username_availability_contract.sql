-- The deployed signup RPC predates the versioned migration history. Keep its
-- lower(trim(input)) lookup and boolean result while pinning its permissions.
-- This is a forward migration over an existing profiles/auth schema, not a
-- complete fresh-project baseline (see README.md).
begin;

create or replace function public.check_username_available(target_username text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text := pg_catalog.lower(pg_catalog.btrim(target_username));
begin
  -- Valid app usernames contain 3..100 ASCII letters, digits, dots/underscores.
  -- Reject malformed direct RPC calls rather than reporting them as available.
  if normalized_username is null
     or pg_catalog.char_length(normalized_username) not between 3 and 100
     or normalized_username !~ '^[a-z0-9._]+$' then
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
  'Signup-safe username availability only; lower/trim normalization, no profile fields returned.';

commit;
