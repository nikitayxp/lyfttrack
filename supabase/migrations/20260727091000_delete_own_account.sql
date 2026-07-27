-- ---------------------------------------------------------------------------
-- Self-service account deletion (issue #42)
--
-- The Privacy Policy already tells users they can delete their account, so the
-- capability has to exist end to end: auth identity plus every row keyed to
-- that user, with nothing orphaned behind.
--
-- Deletion is done explicitly rather than relying on ON DELETE CASCADE. The
-- foreign keys were added across several migrations and not all of them are
-- guaranteed to cascade to auth.users; listing the tables makes the blast
-- radius reviewable and keeps the function correct either way. Deleting a row
-- twice is harmless, so overlapping with an existing cascade is safe.
-- ---------------------------------------------------------------------------

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_user_id uuid := auth.uid();
begin
  if target_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Social interactions this user left on any workout, including other
  -- people's, so their name does not linger on content they no longer own.
  delete from public.workout_comments where user_id = target_user_id;
  delete from public.workout_likes where user_id = target_user_id;

  -- Interactions other people left on this user's workouts, which would
  -- otherwise outlive the workouts they point at.
  delete from public.workout_comments
  where workout_id in (select id from public.workouts where user_id = target_user_id);

  delete from public.workout_likes
  where workout_id in (select id from public.workouts where user_id = target_user_id);

  -- Training data, children before parents.
  delete from public.sets
  where workout_id in (select id from public.workouts where user_id = target_user_id);

  delete from public.workout_exercises
  where workout_id in (select id from public.workouts where user_id = target_user_id);

  delete from public.workouts where user_id = target_user_id;

  delete from public.template_exercises
  where template_id in (select id from public.workout_templates where user_id = target_user_id);

  delete from public.workout_templates where user_id = target_user_id;

  delete from public.routine_exercises
  where routine_id in (select id from public.routines where user_id = target_user_id);

  delete from public.routines where user_id = target_user_id;

  delete from public.body_measurements where user_id = target_user_id;

  -- Social graph, from both directions.
  delete from public.friends
  where user_low_id = target_user_id or user_high_id = target_user_id;

  delete from public.friend_requests
  where from_user_id = target_user_id or to_user_id = target_user_id;

  -- Custom exercises only: the shared catalogue is not user-owned and must
  -- survive, or every other athlete loses their exercise references. Rows that
  -- anything else still points at are left in place, since removing them would
  -- break another user's history rather than protect this one's privacy.
  --
  -- All four referencing tables are checked, not just sets: a custom exercise
  -- can still be referenced from a workout, a template or a routine belonging
  -- to someone else, and the foreign key would abort the whole deletion.
  delete from public.exercises
  where created_by = target_user_id
    and is_custom = true
    and not exists (select 1 from public.sets s where s.exercise_id = exercises.id)
    and not exists (select 1 from public.workout_exercises we where we.exercise_id = exercises.id)
    and not exists (select 1 from public.template_exercises te where te.exercise_id = exercises.id)
    and not exists (select 1 from public.routine_exercises re where re.exercise_id = exercises.id);

  delete from public.profiles where id = target_user_id;

  -- Last, so a failure above aborts the transaction with the auth row intact
  -- and the user can retry rather than being locked out of their own data.
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
