begin;

revoke all on table
  public.body_measurements,
  public.exercises,
  public.profiles,
  public.routine_exercises,
  public.routines,
  public.sets,
  public.template_exercises,
  public.workout_exercises,
  public.workout_templates,
  public.workouts
from public, anon;

revoke truncate, trigger, references on table
  public.body_measurements,
  public.exercises,
  public.profiles,
  public.routine_exercises,
  public.routines,
  public.sets,
  public.template_exercises,
  public.workout_exercises,
  public.workout_templates,
  public.workouts
from authenticated;

alter function public.wipe_my_workouts() set search_path = '';
alter function public.wipe_my_custom_exercises() set search_path = '';
alter function public.delete_own_account() set search_path = '';
alter function public.can_view_user_content(uuid) set search_path = '';
alter function public.respond_to_friend_request(uuid, text) set search_path = '';

revoke execute on function
  public.wipe_my_workouts(),
  public.wipe_my_custom_exercises(),
  public.delete_own_account(),
  public.can_view_user_content(uuid),
  public.respond_to_friend_request(uuid, text)
from public, anon;

grant execute on function
  public.wipe_my_workouts(),
  public.wipe_my_custom_exercises(),
  public.delete_own_account(),
  public.can_view_user_content(uuid),
  public.respond_to_friend_request(uuid, text)
to authenticated;

revoke execute on function public.check_username_available(text) from public;
grant execute on function public.check_username_available(text) to anon, authenticated;

do $$
declare
  target_name text;
begin
  if current_setting('server_version_num')::integer >= 170000 then
    foreach target_name in array array[
      'body_measurements', 'exercises', 'profiles', 'routine_exercises', 'routines',
      'sets', 'template_exercises', 'workout_exercises', 'workout_templates', 'workouts'
    ] loop
      execute format('revoke maintain on table public.%I from authenticated', target_name);
    end loop;
  end if;

  if to_regclass('public.projeto_ativo') is not null then
    revoke all on table public.projeto_ativo from public, anon, authenticated;
  end if;

  foreach target_name in array array[
    'public.check_comment_rate_limit()',
    'public.set_profiles_updated_at()',
    'public.touch_profiles_updated_at()',
    'public.prevent_friend_request_identity_change()'
  ] loop
    if to_regprocedure(target_name) is not null then
      execute format('revoke execute on function %s from public, anon', target_name);
    end if;
  end loop;
end;
$$;

commit;
