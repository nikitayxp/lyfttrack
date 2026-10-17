create or replace function public.update_workout_atomic(
  p_workout_id uuid,
  p_workout_patch jsonb,
  p_set_patches jsonb,
  p_exercise_notes jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_patch jsonb;
  v_key text;
  v_value jsonb;
  v_notes text;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if coalesce(jsonb_typeof(p_workout_patch), '') <> 'object'
    or coalesce(jsonb_typeof(p_set_patches), '') <> 'array'
    or coalesce(jsonb_typeof(p_exercise_notes), '') <> 'object' then
    raise exception 'Invalid workout edit payload' using errcode = '22023';
  end if;

  if jsonb_array_length(p_set_patches) > 1000
    or (select count(*) from jsonb_object_keys(p_exercise_notes)) > 500 then
    raise exception 'Workout edit is too large' using errcode = '22023';
  end if;

  if exists (select 1 from jsonb_object_keys(p_workout_patch) as k(key) where key not in ('name', 'notes')) then
    raise exception 'Unexpected workout field' using errcode = '22023';
  end if;

  perform 1 from public.workouts
    where id = p_workout_id and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'Workout not found or not editable' using errcode = '42501';
  end if;

  if p_workout_patch ? 'name' then
    if jsonb_typeof(p_workout_patch->'name') <> 'string'
      or length(btrim(p_workout_patch->>'name')) = 0
      or length(p_workout_patch->>'name') > 100 then
      raise exception 'Invalid workout name' using errcode = '22023';
    end if;
  end if;
  if p_workout_patch ? 'notes' then
    if jsonb_typeof(p_workout_patch->'notes') not in ('null', 'string')
      or length(p_workout_patch->>'notes') > 300 then
      raise exception 'Invalid workout notes' using errcode = '22023';
    end if;
  end if;

  if p_workout_patch <> '{}'::jsonb then
    update public.workouts set
      name = case when p_workout_patch ? 'name' then p_workout_patch->>'name' else name end,
      notes = case when p_workout_patch ? 'notes' then p_workout_patch->>'notes' else notes end
      where id = p_workout_id and user_id = auth.uid();
  end if;

  for v_patch in select value from jsonb_array_elements(p_set_patches) loop
    if jsonb_typeof(v_patch) <> 'object'
      or not (v_patch ? 'id')
      or jsonb_typeof(v_patch->'id') <> 'string'
      or exists (select 1 from jsonb_object_keys(v_patch) as k(key) where key not in ('id', 'weight', 'reps', 'rir', 'side')) then
      raise exception 'Invalid set patch' using errcode = '22023';
    end if;

    for v_key, v_value in select key, value from jsonb_each(v_patch - 'id' - 'side') loop
      if jsonb_typeof(v_value) <> 'null' then
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

    if v_patch ? 'side' then
      if jsonb_typeof(v_patch->'side') <> 'string'
        or v_patch->>'side' not in ('both', 'left', 'right') then
        raise exception 'Invalid set side' using errcode = '22023';
      end if;
    end if;

    update public.sets set
      weight = case when v_patch ? 'weight' then round((v_patch->>'weight')::numeric, 2) else weight end,
      reps = case when v_patch ? 'reps' then (v_patch->>'reps')::integer else reps end,
      rir = case when v_patch ? 'rir' then (v_patch->>'rir')::integer else rir end,
      side = case when v_patch ? 'side' then v_patch->>'side' else side end
      where id = (v_patch->>'id')::uuid and workout_id = p_workout_id;
    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'Set not found in this workout' using errcode = '22023';
    end if;
  end loop;

  for v_key, v_value in select key, value from jsonb_each(p_exercise_notes) loop
    if jsonb_typeof(v_value) not in ('null', 'string') then
      raise exception 'Invalid exercise notes' using errcode = '22023';
    end if;
    v_notes := p_exercise_notes->>v_key;
    if length(v_notes) > 1000 then
      raise exception 'Exercise notes are too long' using errcode = '22023';
    end if;
    update public.workout_exercises set notes = v_notes
      where workout_id = p_workout_id and exercise_id = v_key::uuid;
    get diagnostics v_count = row_count;
    if v_count = 0 and coalesce(v_notes, '') <> '' then
      raise exception 'Exercise not found in this workout' using errcode = '22023';
    end if;
  end loop;
end;
$$;

revoke all on function public.update_workout_atomic(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.update_workout_atomic(uuid, jsonb, jsonb, jsonb) to authenticated;
