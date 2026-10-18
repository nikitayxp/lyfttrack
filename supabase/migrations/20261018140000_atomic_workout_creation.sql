begin;

alter table public.workouts
  add column if not exists client_session_started_at timestamptz,
  add column if not exists client_save_fingerprint text;

create unique index if not exists workouts_owner_client_session_uidx
  on public.workouts (user_id, client_session_started_at)
  where client_session_started_at is not null;

create or replace function public.create_workout_atomic(
  p_expected_user_id uuid, p_workout jsonb, p_exercises jsonb, p_sets jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_start timestamptz;
  v_session_start timestamptz;
  v_end timestamptz;
  v_template uuid;
  v_workout public.workouts%rowtype;
  v_exercise jsonb;
  v_set jsonb;
  v_row public.sets%rowtype;
  v_relation uuid;
  v_key text;
  v_value jsonb;
  v_fingerprint text;
  v_count integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_expected_user_id is distinct from v_user then
    raise exception 'Account changed while saving. Return to the original account to retry.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_workout) is distinct from 'object'
    or jsonb_typeof(p_exercises) is distinct from 'array'
    or jsonb_typeof(p_sets) is distinct from 'array' then
    raise exception 'Invalid workout payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_sets) not between 1 and 1000
    or jsonb_array_length(p_exercises) not between 1 and 500
    or exists (select 1 from jsonb_object_keys(p_workout) k where k not in ('name', 'notes', 'start_time', 'end_time', 'template_id', 'session_started_at')) then
    raise exception 'Invalid workout fields or size' using errcode = '22023';
  end if;
  if jsonb_typeof(p_workout->'name') is distinct from 'string'
    or length(btrim(p_workout->>'name')) not between 1 and 100
    or jsonb_typeof(p_workout->'start_time') is distinct from 'string'
    or jsonb_typeof(p_workout->'end_time') is distinct from 'string'
    or jsonb_typeof(p_workout->'session_started_at') is distinct from 'string'
    or (p_workout ? 'notes' and (jsonb_typeof(p_workout->'notes') not in ('null', 'string') or length(p_workout->>'notes') > 300))
    or (p_workout ? 'template_id' and jsonb_typeof(p_workout->'template_id') not in ('null', 'string')) then
    raise exception 'Invalid workout header' using errcode = '22023';
  end if;
  v_start := (p_workout->>'start_time')::timestamptz;
  v_session_start := (p_workout->>'session_started_at')::timestamptz;
  v_end := (p_workout->>'end_time')::timestamptz;
  if not isfinite(v_session_start) or not isfinite(v_start) or not isfinite(v_end) or v_end < v_start then
    raise exception 'Invalid workout times' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':' || extract(epoch from v_session_start)::text, 0));
  v_fingerprint := md5(jsonb_build_object('header', p_workout - 'end_time' - 'start_time' - 'session_started_at', 'exercises', p_exercises, 'sets', p_sets)::text);
  select * into v_workout from public.workouts
    where user_id = v_user and client_session_started_at = v_session_start for update;
  if found then
    if v_workout.client_save_fingerprint is distinct from v_fingerprint then
      raise exception 'This session is already saved with different data. Check workout history before retrying.' using errcode = '22023';
    end if;
    select count(*) into v_count from public.sets where workout_id = v_workout.id;
    return jsonb_build_object('workout_id', v_workout.id, 'inserted_set_count', v_count, 'start_time', v_workout.start_time, 'end_time', v_workout.end_time);
  end if;
  v_template := nullif(p_workout->>'template_id', '')::uuid;
  if v_template is not null and not exists (select 1 from public.workout_templates where id = v_template and user_id = v_user) then
    v_template := null;
  end if;
  insert into public.workouts (user_id, name, notes, template_id, start_time, end_time, client_session_started_at, client_save_fingerprint)
    values (v_user, btrim(p_workout->>'name'), p_workout->>'notes', v_template, v_start, v_end, v_session_start, v_fingerprint)
    returning * into v_workout;

  for v_exercise in select value from jsonb_array_elements(p_exercises) loop
    if jsonb_typeof(v_exercise) is distinct from 'object' then
      raise exception 'Invalid workout exercise' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_object_keys(v_exercise) k where k not in ('exercise_id', 'order', 'rest_time', 'notes'))
      or jsonb_typeof(v_exercise->'exercise_id') is distinct from 'string'
      or jsonb_typeof(v_exercise->'order') is distinct from 'number'
      or jsonb_typeof(v_exercise->'rest_time') is distinct from 'number'
      or (v_exercise->>'order')::numeric not between 1 and 500
      or (v_exercise->>'order')::numeric <> trunc((v_exercise->>'order')::numeric)
      or (v_exercise->>'rest_time')::numeric not between 0 and 3600
      or (v_exercise->>'rest_time')::numeric <> trunc((v_exercise->>'rest_time')::numeric)
      or (v_exercise ? 'notes' and (jsonb_typeof(v_exercise->'notes') not in ('null', 'string') or length(v_exercise->>'notes') > 1000)) then
      raise exception 'Invalid workout exercise fields' using errcode = '22023';
    end if;
    if not exists (select 1 from public.exercises where id = (v_exercise->>'exercise_id')::uuid)
      or exists (select 1 from public.workout_exercises where workout_id = v_workout.id and (exercise_id = (v_exercise->>'exercise_id')::uuid or "order" = (v_exercise->>'order')::integer)) then
      raise exception 'Exercise unavailable or duplicated' using errcode = '42501';
    end if;
    insert into public.workout_exercises (workout_id, exercise_id, "order", rest_time, notes)
      values (v_workout.id, (v_exercise->>'exercise_id')::uuid, (v_exercise->>'order')::integer, (v_exercise->>'rest_time')::integer, v_exercise->>'notes');
  end loop;

  for v_set in select value from jsonb_array_elements(p_sets) loop
    if jsonb_typeof(v_set) is distinct from 'object' then
      raise exception 'Invalid set' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_object_keys(v_set) k where k not in ('exercise_id', 'set_number', 'weight', 'reps', 'rir', 'set_type', 'side'))
      or jsonb_typeof(v_set->'exercise_id') is distinct from 'string'
      or jsonb_typeof(v_set->'set_number') is distinct from 'number'
      or (v_set->>'set_number')::numeric not between 1 and 100
      or (v_set->>'set_number')::numeric <> trunc((v_set->>'set_number')::numeric)
      or jsonb_typeof(v_set->'set_type') is distinct from 'string'
      or v_set->>'set_type' not in ('normal', 'warmup', 'drop', 'failure')
      or jsonb_typeof(v_set->'side') is distinct from 'string'
      or v_set->>'side' not in ('both', 'left', 'right') then
      raise exception 'Invalid set fields' using errcode = '22023';
    end if;
    for v_key in select unnest(array['weight', 'reps', 'rir']) loop
      v_value := v_set->v_key;
      if v_value is not null and jsonb_typeof(v_value) <> 'null' then
        if jsonb_typeof(v_value) <> 'number' then
          raise exception 'Invalid set number' using errcode = '22023';
        end if;
        if (v_value::text)::numeric < 0
          or (v_value::text)::numeric > (case when v_key = 'rir' then 10 else 1000 end)
          or (v_key in ('reps', 'rir') and (v_value::text)::numeric <> trunc((v_value::text)::numeric)) then
          raise exception 'Set number outside allowed range' using errcode = '22023';
        end if;
      end if;
    end loop;
    select id into v_relation from public.workout_exercises
      where workout_id = v_workout.id and exercise_id = (v_set->>'exercise_id')::uuid;
    if not found or exists (select 1 from public.sets where workout_id = v_workout.id and exercise_id = (v_set->>'exercise_id')::uuid and set_number = (v_set->>'set_number')::integer and side::text = v_set->>'side') then
      raise exception 'Set exercise missing or set duplicated' using errcode = '22023';
    end if;
    v_row := jsonb_populate_record(null::public.sets, v_set);
    insert into public.sets (workout_id, workout_exercise_id, exercise_id, set_number, weight, reps, rir, set_type, side)
      values (v_workout.id, v_relation, v_row.exercise_id, v_row.set_number, v_row.weight, v_row.reps, v_row.rir, v_row.set_type, v_row.side);
  end loop;
  if exists (select 1 from public.workout_exercises we where we.workout_id = v_workout.id and not exists (select 1 from public.sets s where s.workout_exercise_id = we.id)) then
    raise exception 'Workout exercise has no completed sets' using errcode = '22023';
  end if;
  return jsonb_build_object('workout_id', v_workout.id, 'inserted_set_count', jsonb_array_length(p_sets), 'start_time', v_start, 'end_time', v_end);
end;
$$;

revoke all on function public.create_workout_atomic(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_workout_atomic(uuid, jsonb, jsonb, jsonb) to authenticated;

commit;
