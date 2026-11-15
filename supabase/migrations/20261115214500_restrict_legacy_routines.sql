begin;

revoke all on table public.routines, public.routine_exercises from public, anon, authenticated;

commit;
