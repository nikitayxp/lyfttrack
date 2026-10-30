begin;

create or replace function public.can_reference_exercise(target_exercise_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.exercises e
    where e.id = target_exercise_id
      and (e.is_custom = false or e.created_by = (select auth.uid()))
  );
$$;

revoke all on function public.can_reference_exercise(uuid) from public, anon;
grant execute on function public.can_reference_exercise(uuid) to authenticated;

alter policy workout_exercises_insert_owner_only on public.workout_exercises
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = (select auth.uid())
    )
    and public.can_reference_exercise(workout_exercises.exercise_id)
  );

alter policy workout_exercises_update_owner_only on public.workout_exercises
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = (select auth.uid())
    )
    and public.can_reference_exercise(workout_exercises.exercise_id)
  );

alter policy sets_insert_owner_only on public.sets
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = sets.workout_id and w.user_id = (select auth.uid())
    )
    and (sets.exercise_id is null or public.can_reference_exercise(sets.exercise_id))
  );

alter policy sets_update_owner_only on public.sets
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = sets.workout_id and w.user_id = (select auth.uid())
    )
    and (sets.exercise_id is null or public.can_reference_exercise(sets.exercise_id))
  );

alter policy routine_exercises_insert_owner_only on public.routine_exercises
  with check (
    exists (
      select 1 from public.routines r
      where r.id = routine_exercises.routine_id and r.user_id = (select auth.uid())
    )
    and public.can_reference_exercise(routine_exercises.exercise_id)
  );

alter policy routine_exercises_update_owner_only on public.routine_exercises
  with check (
    exists (
      select 1 from public.routines r
      where r.id = routine_exercises.routine_id and r.user_id = (select auth.uid())
    )
    and public.can_reference_exercise(routine_exercises.exercise_id)
  );

alter policy template_exercises_insert_owner_templates on public.template_exercises
  with check (
    exists (
      select 1 from public.workout_templates wt
      where wt.id = template_exercises.template_id and wt.user_id = (select auth.uid())
    )
    and public.can_reference_exercise(template_exercises.exercise_id)
  );

alter policy template_exercises_update_owner_templates on public.template_exercises
  with check (
    exists (
      select 1 from public.workout_templates wt
      where wt.id = template_exercises.template_id and wt.user_id = (select auth.uid())
    )
    and public.can_reference_exercise(template_exercises.exercise_id)
  );

commit;
