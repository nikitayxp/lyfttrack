begin;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated, service_role;

-- Per-schema defaults add to the global function default, so revoke its PUBLIC execution too.
alter default privileges for role postgres
  revoke execute on functions from public;

-- Supabase reserves the defaults of supabase_admin. Its extension objects belong outside public.
-- The preflight found no public objects or extensions owned by that role.
do $$
declare
  trigger_function text;
begin
  if pg_catalog.to_regclass('public.projeto_ativo_id_seq') is not null then
    revoke all on sequence public.projeto_ativo_id_seq from public, anon, authenticated;
  end if;

  foreach trigger_function in array array[
    'public.check_comment_rate_limit()',
    'public.set_profiles_updated_at()',
    'public.touch_profiles_updated_at()',
    'public.prevent_friend_request_identity_change()'
  ] loop
    if pg_catalog.to_regprocedure(trigger_function) is not null then
      execute pg_catalog.format('alter function %s set search_path = %L', trigger_function, '');
      execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role', trigger_function);
    end if;
  end loop;
end;
$$;

commit;
