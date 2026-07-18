-- =============================================================================
-- LyftTrack — seed de teste: conta + Fullbody (Hevy, 18 Jul 2026 13:22)
-- Cola isto no SQL Editor do Supabase (role: postgres).
-- =============================================================================
-- Login:
--   email:    test@lyfttrack.dev
--   password: Test1234!
--
-- Opcional — listar contas existentes antes:
--   select id, email, created_at from auth.users order by created_at desc limit 20;
-- =============================================================================

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid;
  v_workout_id uuid;
  v_we_id uuid;
  v_ex_id uuid;
  v_start timestamptz := '2026-07-18 13:22:00+01';
  v_end   timestamptz := '2026-07-18 14:28:00+01';
  v_email text := 'test@lyfttrack.dev';
  v_password text := 'Test1234!';
begin
  -- -------------------------------------------------------------------------
  -- 1) Conta de testes (reutiliza se ja existir)
  -- -------------------------------------------------------------------------
  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      coalesce(
        (select id from auth.instances limit 1),
        '00000000-0000-0000-0000-000000000000'
      ),
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Test Athlete"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
  end if;

  insert into public.profiles (id, username, full_name, visibility)
  values (v_user_id, 'test_athlete', 'Test Athlete', 'public')
  on conflict (id) do update
    set full_name = excluded.full_name;

  -- -------------------------------------------------------------------------
  -- 2) Resolver / criar exercicios do Fullbody
  -- -------------------------------------------------------------------------
  create temporary table tmp_seed_exercises (
    sort_order int primary key,
    lookup_names text[],
    create_name text,
    create_name_pt text,
    create_name_en text,
    muscle_group text,
    equipment text,
    notes text,
    exercise_id uuid
  ) on commit drop;

  insert into tmp_seed_exercises (
    sort_order, lookup_names, create_name, create_name_pt, create_name_en,
    muscle_group, equipment, notes
  ) values
    (1, array['Elevação Lateral (Máquina)','Elevacao Lateral (Maquina)','Side Lateral Raise','Lateral Raise Machine'],
        'Elevação Lateral (Máquina)', 'Elevação Lateral (Máquina)', 'Side Lateral Raise (Machine)',
        'shoulders', 'machine', '0 rir'),
    (2, array['Desenvolvimento de Ombros (Máquina de Placas)','Desenvolvimento de Ombros','Machine Shoulder Press','Shoulder Press Machine'],
        'Desenvolvimento de Ombros (Máquina de Placas)', 'Desenvolvimento de Ombros (Máquina de Placas)', 'Machine Shoulder Press',
        'shoulders', 'machine', '1 rir'),
    (3, array['Supino (Halter)','Supino com Halteres','Dumbbell Bench Press'],
        'Supino (Halter)', 'Supino (Halter)', 'Dumbbell Bench Press',
        'chest', 'dumbbell', '0 rir'),
    (4, array['Rosca Scott (Halter)','Rosca Scott','Preacher Curl','Dumbbell Preacher Curl'],
        'Rosca Scott (Halter)', 'Rosca Scott (Halter)', 'Dumbbell Preacher Curl',
        'biceps', 'dumbbell', 'E 1 rir / D 1 rir'),
    (5, array['Extensão de Tríceps Unilateral (Cabo)','Extensao de Triceps Unilateral (Cabo)','Cable One Arm Tricep Extension'],
        'Extensão de Tríceps Unilateral (Cabo)', 'Extensão de Tríceps Unilateral (Cabo)', 'Cable One Arm Tricep Extension',
        'triceps', 'cable', 'D 4 0 rir / E 5 0 rir'),
    (6, array['Extensão de tríceps acima da cabeça (cabo)','Extensao de triceps acima da cabeca (cabo)','Cable Rope Overhead Triceps Extension','Overhead Tricep Extension'],
        'Extensão de tríceps acima da cabeça (cabo)', 'Extensão de tríceps acima da cabeça (cabo)', 'Cable Rope Overhead Triceps Extension',
        'triceps', 'cable', 'Baixo 9 / 1 rir'),
    (7, array['Crucifixo no Voador (Máquina)','Crucifixo no Voador','Pec Deck','Butterfly'],
        'Crucifixo no Voador (Máquina)', 'Crucifixo no Voador (Máquina)', 'Pec Deck / Butterfly',
        'chest', 'machine', '5 0 rir');

  update tmp_seed_exercises s
  set exercise_id = (
    select ex.id
    from public.exercises ex
    where ex.name = any (s.lookup_names)
       or ex.name_pt = any (s.lookup_names)
       or ex.name_en = any (s.lookup_names)
    order by ex.is_custom asc, ex.name asc
    limit 1
  );

  insert into public.exercises (
    name, name_pt, name_en, muscle_group, equipment, is_custom, created_by
  )
  select
    s.create_name, s.create_name_pt, s.create_name_en,
    s.muscle_group, s.equipment, true, v_user_id
  from tmp_seed_exercises s
  where s.exercise_id is null;

  update tmp_seed_exercises s
  set exercise_id = (
    select ex.id
    from public.exercises ex
    where ex.name = s.create_name or ex.name_pt = s.create_name_pt
    order by ex.is_custom desc, ex.name asc
    limit 1
  )
  where s.exercise_id is null;

  if exists (select 1 from tmp_seed_exercises where exercise_id is null) then
    raise exception 'Failed to resolve all exercises for seed';
  end if;

  -- -------------------------------------------------------------------------
  -- 3) Remover Fullbody de teste anterior (idempotente)
  -- -------------------------------------------------------------------------
  delete from public.sets
  where workout_id in (
    select id from public.workouts
    where user_id = v_user_id and name = 'Fullbody' and start_time = v_start
  );

  delete from public.workout_exercises
  where workout_id in (
    select id from public.workouts
    where user_id = v_user_id and name = 'Fullbody' and start_time = v_start
  );

  delete from public.workouts
  where user_id = v_user_id and name = 'Fullbody' and start_time = v_start;

  -- -------------------------------------------------------------------------
  -- 4) Inserir workout + series
  -- -------------------------------------------------------------------------
  insert into public.workouts (id, user_id, name, notes, start_time, end_time)
  values (gen_random_uuid(), v_user_id, 'Fullbody', 'Seed Hevy — Sabado 18 Jul 2026 13:22', v_start, v_end)
  returning id into v_workout_id;

  -- 1 Elevacao Lateral
  select exercise_id into v_ex_id from tmp_seed_exercises where sort_order = 1;
  insert into public.workout_exercises (workout_id, exercise_id, "order", notes)
  values (v_workout_id, v_ex_id, 1, '0 rir') returning id into v_we_id;
  insert into public.sets (workout_id, workout_exercise_id, exercise_id, set_number, set_type, side, weight, reps, rir) values
    (v_workout_id, v_we_id, v_ex_id, 1, 'warmup', 'both', 13, 5, 0),
    (v_workout_id, v_we_id, v_ex_id, 2, 'normal', 'both', 32.5, 5, 0);

  -- 2 Desenvolvimento Ombros
  select exercise_id into v_ex_id from tmp_seed_exercises where sort_order = 2;
  insert into public.workout_exercises (workout_id, exercise_id, "order", notes)
  values (v_workout_id, v_ex_id, 2, '1 rir') returning id into v_we_id;
  insert into public.sets (workout_id, workout_exercise_id, exercise_id, set_number, set_type, side, weight, reps, rir) values
    (v_workout_id, v_we_id, v_ex_id, 1, 'warmup', 'both', 15, 5, null),
    (v_workout_id, v_we_id, v_ex_id, 2, 'warmup', 'both', 25, 2, null),
    (v_workout_id, v_we_id, v_ex_id, 3, 'normal', 'both', 30, 5, 1);

  -- 3 Supino Halter
  select exercise_id into v_ex_id from tmp_seed_exercises where sort_order = 3;
  insert into public.workout_exercises (workout_id, exercise_id, "order", notes)
  values (v_workout_id, v_ex_id, 3, '0 rir') returning id into v_we_id;
  insert into public.sets (workout_id, workout_exercise_id, exercise_id, set_number, set_type, side, weight, reps, rir) values
    (v_workout_id, v_we_id, v_ex_id, 1, 'warmup', 'both', 15, 8, 0),
    (v_workout_id, v_we_id, v_ex_id, 2, 'normal', 'both', 27.5, 6, 0);

  -- 4 Rosca Scott
  select exercise_id into v_ex_id from tmp_seed_exercises where sort_order = 4;
  insert into public.workout_exercises (workout_id, exercise_id, "order", notes)
  values (v_workout_id, v_ex_id, 4, 'E 1 rir / D 1 rir') returning id into v_we_id;
  insert into public.sets (workout_id, workout_exercise_id, exercise_id, set_number, set_type, side, weight, reps, rir) values
    (v_workout_id, v_we_id, v_ex_id, 1, 'warmup', 'both', 7.5, 6, 1),
    (v_workout_id, v_we_id, v_ex_id, 2, 'normal', 'both', 12.5, 6, 1);

  -- 5 Triceps unilateral
  select exercise_id into v_ex_id from tmp_seed_exercises where sort_order = 5;
  insert into public.workout_exercises (workout_id, exercise_id, "order", notes)
  values (v_workout_id, v_ex_id, 5, 'D 4 0 rir / E 5 0 rir') returning id into v_we_id;
  insert into public.sets (workout_id, workout_exercise_id, exercise_id, set_number, set_type, side, weight, reps, rir) values
    (v_workout_id, v_we_id, v_ex_id, 1, 'warmup', 'both', 15, 7, 0),
    (v_workout_id, v_we_id, v_ex_id, 2, 'normal', 'both', 30, 4, 0);

  -- 6 Triceps overhead
  select exercise_id into v_ex_id from tmp_seed_exercises where sort_order = 6;
  insert into public.workout_exercises (workout_id, exercise_id, "order", notes)
  values (v_workout_id, v_ex_id, 6, 'Baixo 9 / 1 rir') returning id into v_we_id;
  insert into public.sets (workout_id, workout_exercise_id, exercise_id, set_number, set_type, side, weight, reps, rir) values
    (v_workout_id, v_we_id, v_ex_id, 1, 'warmup', 'both', 15, 8, 1),
    (v_workout_id, v_we_id, v_ex_id, 2, 'normal', 'both', 30, 7, 1);

  -- 7 Crucifixo voador
  select exercise_id into v_ex_id from tmp_seed_exercises where sort_order = 7;
  insert into public.workout_exercises (workout_id, exercise_id, "order", notes)
  values (v_workout_id, v_ex_id, 7, '5 0 rir') returning id into v_we_id;
  insert into public.sets (workout_id, workout_exercise_id, exercise_id, set_number, set_type, side, weight, reps, rir) values
    (v_workout_id, v_we_id, v_ex_id, 1, 'warmup', 'both', 45.5, 7, 0),
    (v_workout_id, v_we_id, v_ex_id, 2, 'normal', 'both', 84.5, 5, 0);

  raise notice 'OK — user_id=% workout_id=% | login % / %',
    v_user_id, v_workout_id, v_email, v_password;
end $$;
