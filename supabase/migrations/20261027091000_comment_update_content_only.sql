begin;

revoke update on public.workout_comments from authenticated, anon;
grant update (content) on public.workout_comments to authenticated;

commit;
