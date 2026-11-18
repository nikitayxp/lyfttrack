-- Apply only after the compatible exercise/notes reader has been deployed.
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public.exercises_read') is null
    or to_regclass('public.workout_exercises_read') is null then
    raise exception 'Deploy the exercise read views before restricting base columns';
  end if;
end;
$$;

revoke select on public.exercises from public, anon, authenticated;
revoke select (description, aliases) on public.exercises from public, anon, authenticated;
grant select (id, name, muscle_group, equipment, is_custom, created_by, name_pt,
  image_url, name_en, muscle_en, muscle_pt, listed) on public.exercises to authenticated;

-- Custom block notes may contain snapshots of the private description. The
-- view retains them for the workout owner without rewriting existing data.
revoke select on public.workout_exercises from public, anon, authenticated;
revoke select (notes) on public.workout_exercises from public, anon, authenticated;
grant select (id, workout_id, exercise_id, "order", rest_time)
  on public.workout_exercises to authenticated;

notify pgrst, 'reload schema';
commit;
