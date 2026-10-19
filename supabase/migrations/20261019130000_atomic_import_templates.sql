begin;

create table public.client_mutation_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  fingerprint text not null,
  result_id uuid not null,
  result_data jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, mutation_id)
);
alter table public.client_mutation_receipts enable row level security;
create policy client_mutation_receipts_owner on public.client_mutation_receipts
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.client_mutation_receipts from public, anon;
grant select, insert on public.client_mutation_receipts to authenticated;

create function public.template_snapshot(p_template_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('name', t.name, 'notes', t.notes, 'exercises',
    coalesce((select jsonb_agg(jsonb_build_object('exercise_id', e.exercise_id,
      'order_index', e.order_index, 'rest_seconds', e.rest_seconds) order by e.order_index, e.id)
      from public.template_exercises e where e.template_id=t.id), '[]'::jsonb))
  from public.workout_templates t where t.id=p_template_id and t.user_id=(select auth.uid())
$$;

create function public.import_workout_snapshot(p_workout_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('name', w.name, 'notes', w.notes,
    'exercises',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.workout_exercises e where e.workout_id=w.id),'[]'::jsonb),
    'sets',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.sets s where s.workout_id=w.id),'[]'::jsonb))
  from public.workouts w where w.id=p_workout_id and w.user_id=(select auth.uid())
$$;

create function public.import_workout_snapshots(p_workout_ids uuid[]) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
begin
  if cardinality(p_workout_ids)>100 then raise exception 'Too many repair snapshots'; end if;
  return (select coalesce(jsonb_object_agg(w.id, public.import_workout_snapshot(w.id)), '{}'::jsonb)
    from public.workouts w where w.id=any(p_workout_ids) and w.user_id=(select auth.uid()));
end;
$$;

create function public.save_template_atomic(
  p_expected_user_id uuid, p_mutation_id uuid, p_template_id uuid,
  p_name text, p_exercises jsonb, p_expected_snapshot jsonb default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_fingerprint text; v_receipt public.client_mutation_receipts%rowtype;
  v_entry jsonb; v_exists boolean;
begin
  if v_user is null or v_user is distinct from p_expected_user_id then
    raise exception 'Account changed or authentication required' using errcode='42501';
  end if;
  if p_mutation_id is null or p_template_id is null or p_name is null or length(btrim(p_name)) not between 2 and 100
    or jsonb_typeof(p_exercises) is distinct from 'array' then
    raise exception 'Invalid template payload' using errcode='22023';
  end if;
  if jsonb_array_length(p_exercises) not between 1 and 500 then
    raise exception 'Invalid template exercise count' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_mutation_id::text,0));
  v_fingerprint := md5(jsonb_build_array('template',p_template_id,p_name,p_exercises)::text);
  select * into v_receipt from public.client_mutation_receipts where user_id=v_user and mutation_id=p_mutation_id;
  if found then
    if v_receipt.fingerprint is distinct from v_fingerprint then
      raise exception 'Mutation identity already used with different data' using errcode='22023';
    end if;
    return v_receipt.result_id;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('template:'||p_template_id::text,0));
  perform 1 from public.workout_templates where id=p_template_id and user_id=v_user for update;
  v_exists := found;
  if v_exists then
    if p_expected_snapshot is null or public.template_snapshot(p_template_id) is distinct from p_expected_snapshot then
      raise exception 'Template changed. Reload before saving.' using errcode='40001';
    end if;
    update public.workout_templates set name=btrim(p_name) where id=p_template_id and user_id=v_user;
    delete from public.template_exercises where template_id=p_template_id;
  else
    if p_expected_snapshot is not null then
      raise exception 'Template changed or unavailable' using errcode='40001';
    end if;
    insert into public.workout_templates (id,user_id,name,notes) values (p_template_id,v_user,btrim(p_name),null);
  end if;
  for v_entry in select value from jsonb_array_elements(p_exercises) loop
    if jsonb_typeof(v_entry) is distinct from 'object' then raise exception 'Invalid template exercise'; end if;
    if exists(select 1 from jsonb_object_keys(v_entry) k where k not in ('exercise_id','order_index','rest_seconds'))
      or jsonb_typeof(v_entry->'exercise_id') is distinct from 'string'
      or jsonb_typeof(v_entry->'order_index') is distinct from 'number'
      or (v_entry->>'order_index')::numeric not between 1 and 500
      or (v_entry->>'order_index')::numeric <> trunc((v_entry->>'order_index')::numeric)
      or jsonb_typeof(v_entry->'rest_seconds') is distinct from 'number'
      or (v_entry->>'rest_seconds')::numeric not between 15 and 900
      or (v_entry->>'rest_seconds')::numeric <> trunc((v_entry->>'rest_seconds')::numeric) then
      raise exception 'Invalid template exercise fields' using errcode='22023';
    end if;
    if not exists(select 1 from public.exercises where id=(v_entry->>'exercise_id')::uuid)
      or exists(select 1 from public.template_exercises where template_id=p_template_id and
        (exercise_id=(v_entry->>'exercise_id')::uuid or order_index=(v_entry->>'order_index')::integer)) then
      raise exception 'Exercise unavailable or duplicated' using errcode='42501';
    end if;
    insert into public.template_exercises (template_id,exercise_id,order_index,rest_seconds)
      values(p_template_id,(v_entry->>'exercise_id')::uuid,(v_entry->>'order_index')::integer,(v_entry->>'rest_seconds')::integer);
  end loop;
  insert into public.client_mutation_receipts(user_id,mutation_id,fingerprint,result_id) values(v_user,p_mutation_id,v_fingerprint,p_template_id);
  return p_template_id;
end;
$$;

create function public.import_workouts_atomic(p_expected_user_id uuid,p_mutation_id uuid,p_batch jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid:=auth.uid(); v_item jsonb; v_result jsonb; v_existing uuid;
  v_fingerprint text; v_receipt public.client_mutation_receipts%rowtype;
  v_ids jsonb:='[]'::jsonb; v_workouts integer:=0; v_sets integer:=0; v_skipped integer:=0;
begin
  if v_user is null or v_user is distinct from p_expected_user_id then raise exception 'Account changed or authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_batch) is distinct from 'array' then raise exception 'Invalid import batch'; end if;
  if jsonb_array_length(p_batch) not between 1 and 20 then raise exception 'Invalid import batch size'; end if;
  if p_mutation_id is null then raise exception 'Missing import mutation identity'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_mutation_id::text,0));
  v_fingerprint:=md5(jsonb_build_array('import',p_batch)::text);
  select * into v_receipt from public.client_mutation_receipts where user_id=v_user and mutation_id=p_mutation_id;
  if found then
    if v_receipt.fingerprint is distinct from v_fingerprint then raise exception 'Mutation identity already used with different data'; end if;
    return v_receipt.result_data;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('import:'||v_user::text,0));
  for v_item in select value from jsonb_array_elements(p_batch) loop
    if jsonb_typeof(v_item) is distinct from 'object' or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('workout','exercises','sets')) then raise exception 'Invalid import item'; end if;
    select id into v_existing from public.workouts where user_id=v_user and start_time=(v_item->'workout'->>'start_time')::timestamptz order by id limit 1;
    if found then
      v_ids:=v_ids||jsonb_build_array(v_existing); v_skipped:=v_skipped+1;
    else
      v_result:=public.create_workout_atomic(p_expected_user_id,v_item->'workout',v_item->'exercises',v_item->'sets');
      v_ids:=v_ids||jsonb_build_array(v_result->>'workout_id'); v_workouts:=v_workouts+1; v_sets:=v_sets+(v_result->>'inserted_set_count')::integer;
    end if;
  end loop;
  v_result:=jsonb_build_object('workout_ids',v_ids,'workouts',v_workouts,'sets',v_sets,'skipped',v_skipped);
  insert into public.client_mutation_receipts(user_id,mutation_id,fingerprint,result_id,result_data)
    values(v_user,p_mutation_id,v_fingerprint,(v_ids->>0)::uuid,v_result);
  return v_result;
end;
$$;

create function public.repair_imported_workout_atomic(
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
      into p_exercises from public.workout_exercises e join jsonb_array_elements(p_exercises) x on (x.value->>'order')::integer=e."order" where e.workout_id=p_workout_id;
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

create function public.ensure_import_exercises(p_expected_user_id uuid,p_exercises jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_entry jsonb; v_id uuid; v_name text; v_ids jsonb:='[]'::jsonb; v_created integer:=0;
begin
  if v_user is null or v_user is distinct from p_expected_user_id then raise exception 'Account changed or authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_exercises) is distinct from 'array' then raise exception 'Invalid exercises'; end if;
  if jsonb_array_length(p_exercises)>500 then raise exception 'Too many exercises'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('import-exercises:'||v_user::text,0));
  for v_entry in select value from jsonb_array_elements(p_exercises) loop
    v_name:=btrim(v_entry->>'name');
    if jsonb_typeof(v_entry) is distinct from 'object' or jsonb_typeof(v_entry->'name') is distinct from 'string'
      or length(v_name) not between 1 and 100 or length(v_entry->>'muscle_group')>100 or length(v_entry->>'equipment')>100 then raise exception 'Invalid exercise'; end if;
    select id into v_id from public.exercises where created_by=v_user and is_custom and lower(btrim(name))=lower(v_name) order by id limit 1;
    if not found then
      insert into public.exercises(name,name_en,name_pt,created_by,is_custom,muscle_group,equipment)
        values(v_name,v_name,v_name,v_user,true,v_entry->>'muscle_group',v_entry->>'equipment') returning id into v_id;
      v_created:=v_created+1;
    end if;
    v_ids:=v_ids||jsonb_build_array(v_id);
  end loop;
  return jsonb_build_object('ids',v_ids,'created',v_created);
end;
$$;

revoke all on function public.template_snapshot(uuid),public.import_workout_snapshot(uuid),public.import_workout_snapshots(uuid[]),public.save_template_atomic(uuid,uuid,uuid,text,jsonb,jsonb),public.import_workouts_atomic(uuid,uuid,jsonb),public.repair_imported_workout_atomic(uuid,uuid,uuid,jsonb,jsonb,jsonb,text,jsonb),public.ensure_import_exercises(uuid,jsonb) from public,anon;
grant execute on function public.template_snapshot(uuid),public.import_workout_snapshot(uuid),public.import_workout_snapshots(uuid[]),public.save_template_atomic(uuid,uuid,uuid,text,jsonb,jsonb),public.import_workouts_atomic(uuid,uuid,jsonb),public.repair_imported_workout_atomic(uuid,uuid,uuid,jsonb,jsonb,jsonb,text,jsonb),public.ensure_import_exercises(uuid,jsonb) to authenticated;

commit;
