begin;

set local lock_timeout = '5s';

-- Base-row visibility remains governed by the existing RLS policies. Only
-- these guarded readers may fetch columns that will lose their client grants.
create or replace function private.exercise_sensitive_details(p_exercise_id uuid)
returns table (description text, aliases text[])
language sql stable security definer set search_path = '' as $$
  select e.description, e.aliases
  from public.exercises e
  where e.id = p_exercise_id
    and (e.is_custom = false or e.created_by = (select auth.uid()))
$$;

create or replace function private.workout_exercise_shared_notes(p_block_id uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select we.notes
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id
  left join public.exercises e on e.id = we.exercise_id
  where we.id = p_block_id
    and (
      w.user_id = (select auth.uid())
      or (e.is_custom = false and public.can_view_user_content(w.user_id))
    )
$$;

revoke all on function private.exercise_sensitive_details(uuid),
  private.workout_exercise_shared_notes(uuid) from public, anon, authenticated, service_role;
grant execute on function private.exercise_sensitive_details(uuid),
  private.workout_exercise_shared_notes(uuid) to authenticated;

create or replace view public.exercises_read
with (security_invoker = true, security_barrier = true) as
  select e.id, e.name, e.muscle_group, e.equipment, e.is_custom, e.created_by,
    e.name_pt, e.image_url, e.name_en, e.muscle_en, e.muscle_pt,
    details.description, coalesce(details.aliases, array[]::text[]) as aliases,
    e.listed
  from public.exercises e
  left join lateral private.exercise_sensitive_details(e.id) details on true;

create or replace view public.workout_exercises_read
with (security_invoker = true, security_barrier = true) as
  select we.id, we.workout_id, we.exercise_id, we."order", we.rest_time,
    private.workout_exercise_shared_notes(we.id) as notes
  from public.workout_exercises we;

revoke all on public.exercises_read, public.workout_exercises_read
  from public, anon, authenticated, service_role;
grant select on public.exercises_read, public.workout_exercises_read to authenticated;

-- The repair snapshot is owner-only. Keep its shape and concurrency contract
-- while letting it read notes after the old column grants are removed.
create or replace function public.import_workout_snapshot(p_workout_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('name', w.name, 'notes', w.notes,
    'exercises', coalesce((select jsonb_agg(to_jsonb(e) order by e.id)
      from public.workout_exercises_read e where e.workout_id = w.id), '[]'::jsonb),
    'sets', coalesce((select jsonb_agg(to_jsonb(s) order by s.id)
      from public.sets s where s.workout_id = w.id), '[]'::jsonb))
  from public.workouts w where w.id = p_workout_id and w.user_id = (select auth.uid())
$$;

-- Preserve remapped historical notes through the same guarded read path.
create or replace function public.repair_imported_workout_atomic(
  p_expected_user_id uuid,p_mutation_id uuid,p_workout_id uuid,p_workout jsonb,
  p_exercises jsonb,p_sets jsonb,p_mode text,p_expected_snapshot jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid:=auth.uid(); v_fingerprint text; v_receipt public.client_mutation_receipts%rowtype;
  v_workout public.workouts%rowtype; v_exercise jsonb; v_set jsonb; v_row public.sets%rowtype;
  v_relation uuid; v_key text; v_value jsonb;
begin
  if v_user is null or v_user is distinct from p_expected_user_id then raise exception 'Account changed or authentication required' using errcode='42501'; end if;
  if p_mutation_id is null or p_mode not in ('remap','rebuild') or p_mode is null
    or jsonb_typeof(p_workout) is distinct from 'object' or jsonb_typeof(p_exercises) is distinct from 'array' or jsonb_typeof(p_sets) is distinct from 'array' then raise exception 'Invalid repair payload'; end if;
  if jsonb_array_length(p_exercises) not between 1 and 500 or jsonb_array_length(p_sets)>1000 then raise exception 'Invalid repair size'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_mutation_id::text,0));
  v_fingerprint:=md5(jsonb_build_array('repair',p_workout_id,p_workout,p_exercises,p_sets,p_mode)::text);
  select * into v_receipt from public.client_mutation_receipts where user_id=v_user and mutation_id=p_mutation_id;
  if found then
    if v_receipt.fingerprint is distinct from v_fingerprint then raise exception 'Mutation identity already used with different data'; end if;
    return v_receipt.result_id;
  end if;
  select * into v_workout from public.workouts where id=p_workout_id and user_id=v_user for update;
  if not found then raise exception 'Workout unavailable' using errcode='42501'; end if;
  perform 1 from public.workout_exercises where workout_id=p_workout_id for update;
  perform 1 from public.sets where workout_id=p_workout_id for update;
  if p_expected_snapshot is null or public.import_workout_snapshot(p_workout_id) is distinct from p_expected_snapshot then raise exception 'Workout changed. Reload before repairing.' using errcode='40001'; end if;
  if jsonb_typeof(p_workout->'name') is distinct from 'string' or length(btrim(p_workout->>'name')) not between 1 and 100
    or (p_workout ? 'notes' and (jsonb_typeof(p_workout->'notes') not in ('null','string') or length(p_workout->>'notes')>300)) then raise exception 'Invalid repair header'; end if;
  if p_mode='remap' then
    if exists(select 1 from public.sets s where s.workout_id=p_workout_id and not exists(
      select 1 from public.workout_exercises e where e.id=s.workout_exercise_id
        and e.workout_id=p_workout_id and e.exercise_id=s.exercise_id)) then
      raise exception 'Repair has unmapped legacy sets. No history was changed.' using errcode='22023';
    end if;
    if jsonb_array_length(p_exercises)<>(select count(*) from public.workout_exercises where workout_id=p_workout_id)
      or exists(select 1 from public.workout_exercises e where e.workout_id=p_workout_id and not exists(select 1 from jsonb_array_elements(p_exercises) x where (x->>'order')::integer=e."order")) then raise exception 'Repair mapping changed'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'exercise_id',x.value->>'exercise_id','set_number',s.set_number,'weight',s.weight,'reps',s.reps,'rir',s.rir,'set_type',s.set_type,'side',s.side) order by s.id),'[]'::jsonb)
      into p_sets from public.sets s join public.workout_exercises e on e.id=s.workout_exercise_id
      join jsonb_array_elements(p_exercises) x on (x.value->>'order')::integer=e."order" where s.workout_id=p_workout_id;
    select jsonb_agg(jsonb_build_object('id',e.id,'exercise_id',x.value->>'exercise_id','order',e."order",'notes',e.notes,'rest_time',coalesce(e.rest_time,90)) order by e."order")
      into p_exercises from public.workout_exercises_read e join jsonb_array_elements(p_exercises) x on (x.value->>'order')::integer=e."order" where e.workout_id=p_workout_id;
  end if;
  if jsonb_array_length(p_sets) not between 1 and 1000 then raise exception 'Invalid repair set count'; end if;
  update public.workouts set name=btrim(p_workout->>'name'),notes=p_workout->>'notes' where id=p_workout_id and user_id=v_user;
  delete from public.sets where workout_id=p_workout_id;
  delete from public.workout_exercises where workout_id=p_workout_id;
  for v_exercise in select value from jsonb_array_elements(p_exercises) loop
    if jsonb_typeof(v_exercise) is distinct from 'object' then
      raise exception 'Invalid workout exercise' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_object_keys(v_exercise) k where k not in ('exercise_id', 'order', 'rest_time', 'notes') and not (p_mode='remap' and k='id'))
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
    insert into public.workout_exercises (id, workout_id, exercise_id, "order", rest_time, notes)
      values (case when p_mode='remap' then (v_exercise->>'id')::uuid else gen_random_uuid() end, v_workout.id, (v_exercise->>'exercise_id')::uuid, (v_exercise->>'order')::integer, (v_exercise->>'rest_time')::integer, v_exercise->>'notes');
  end loop;

  for v_set in select value from jsonb_array_elements(p_sets) loop
    if jsonb_typeof(v_set) is distinct from 'object' then
      raise exception 'Invalid set' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_object_keys(v_set) k where k not in ('exercise_id', 'set_number', 'weight', 'reps', 'rir', 'set_type', 'side') and not (p_mode='remap' and k='id'))
      or jsonb_typeof(v_set->'exercise_id') is distinct from 'string'
      or jsonb_typeof(v_set->'set_number') is distinct from 'number'
      or (v_set->>'set_number')::numeric not between 1 and 100
      or (v_set->>'set_number')::numeric <> trunc((v_set->>'set_number')::numeric)
      -- Remap reads set types from locked stored rows, not the submitted sets.
      -- Preserve the table's supported legacy values (dropset and NULL).
      or (p_mode <> 'remap' and (
        jsonb_typeof(v_set->'set_type') is distinct from 'string'
        or v_set->>'set_type' not in ('normal', 'warmup', 'drop', 'failure')
      ))
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
    insert into public.sets (id, workout_id, workout_exercise_id, exercise_id, set_number, weight, reps, rir, set_type, side)
      values (case when p_mode='remap' then v_row.id else gen_random_uuid() end, v_workout.id, v_relation, v_row.exercise_id, v_row.set_number, v_row.weight, v_row.reps, v_row.rir, v_row.set_type, v_row.side);
  end loop;
  if exists (select 1 from public.workout_exercises we where we.workout_id = v_workout.id and not exists (select 1 from public.sets s where s.workout_exercise_id = we.id)) then
    raise exception 'Workout exercise has no completed sets' using errcode = '22023';
  end if;
  insert into public.client_mutation_receipts(user_id,mutation_id,fingerprint,result_id) values(v_user,p_mutation_id,v_fingerprint,p_workout_id);
  return p_workout_id;
end;
$$;

notify pgrst, 'reload schema';
commit;
