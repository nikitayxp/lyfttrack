-- Phase 1 DB hardening migration.
-- Goals:
-- 1) Reduce schema/type drift with app client contract.
-- 2) Add social integrity constraints and safe deduplication.
-- 3) Add high-value indexes for feed/social/stats/weight queries.

begin;

-- ---------------------------------------------------------------------------
-- Contract compatibility: body_measurements
-- ---------------------------------------------------------------------------

alter table if exists public.body_measurements
  add column if not exists measured_at timestamp with time zone;

update public.body_measurements
set measured_at = created_at
where measured_at is null;

alter table if exists public.body_measurements
  alter column measured_at set default timezone('utc'::text, now());

alter table if exists public.body_measurements
  alter column measured_at set not null;

-- ---------------------------------------------------------------------------
-- Contract compatibility: exercises i18n fields
-- ---------------------------------------------------------------------------

alter table if exists public.exercises add column if not exists name_en text;
alter table if exists public.exercises add column if not exists name_pt text;
alter table if exists public.exercises add column if not exists muscle_en text;
alter table if exists public.exercises add column if not exists muscle_pt text;

update public.exercises
set
  name_en = coalesce(nullif(btrim(name_en), ''), name),
  name_pt = coalesce(nullif(btrim(name_pt), ''), name),
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), muscle_group),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), muscle_group)
where
  name_en is null
  or name_pt is null
  or muscle_en is null
  or muscle_pt is null;

-- ---------------------------------------------------------------------------
-- Contract compatibility: sets.set_type accepts both legacy and canonical values
-- ---------------------------------------------------------------------------

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.sets'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%set_type%'
  loop
    execute format('alter table public.sets drop constraint if exists %I', constraint_row.conname);
  end loop;
end;
$$;

alter table if exists public.sets
  add constraint sets_set_type_check
  check (
    set_type is null
    or set_type = any (array['normal'::text, 'warmup'::text, 'drop'::text, 'dropset'::text, 'failure'::text])
  ) not valid;

alter table if exists public.sets
  validate constraint sets_set_type_check;

-- ---------------------------------------------------------------------------
-- Social integrity cleanup and constraints
-- ---------------------------------------------------------------------------

-- Canonicalize friendship pair ordering first.
with normalized_friend_pairs as (
  select
    id,
    least(user_low_id, user_high_id) as normalized_low_id,
    greatest(user_low_id, user_high_id) as normalized_high_id
  from public.friends
  where user_low_id > user_high_id
)
update public.friends f
set
  user_low_id = n.normalized_low_id,
  user_high_id = n.normalized_high_id
from normalized_friend_pairs n
where f.id = n.id;

-- Remove duplicate likes (same user/workout), keep newest by created_at/id.
with ranked_likes as (
  select
    ctid,
    row_number() over (
      partition by user_id, workout_id
      order by created_at desc, id desc
    ) as rn
  from public.workout_likes
)
delete from public.workout_likes wl
using ranked_likes rl
where wl.ctid = rl.ctid
  and rl.rn > 1;

-- Remove duplicate friendships (same canonical pair), keep newest.
with ranked_friends as (
  select
    ctid,
    row_number() over (
      partition by user_low_id, user_high_id
      order by created_at desc, id desc
    ) as rn
  from public.friends
)
delete from public.friends f
using ranked_friends rf
where f.ctid = rf.ctid
  and rf.rn > 1;

-- Remove duplicate pending friend requests per unordered pair, keep newest pending row.
with ranked_pending_requests as (
  select
    ctid,
    row_number() over (
      partition by least(from_user_id, to_user_id), greatest(from_user_id, to_user_id)
      order by created_at desc, id desc
    ) as rn
  from public.friend_requests
  where status = 'pending'
)
delete from public.friend_requests fr
using ranked_pending_requests rr
where fr.ctid = rr.ctid
  and rr.rn > 1;

-- Add anti-self checks if missing.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'friend_requests_no_self_ck'
      and conrelid = 'public.friend_requests'::regclass
  ) then
    alter table public.friend_requests
      add constraint friend_requests_no_self_ck
      check (from_user_id <> to_user_id) not valid;
  end if;
end;
$$;

alter table public.friend_requests
  validate constraint friend_requests_no_self_ck;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'friends_no_self_ck'
      and conrelid = 'public.friends'::regclass
  ) then
    alter table public.friends
      add constraint friends_no_self_ck
      check (user_low_id <> user_high_id) not valid;
  end if;
end;
$$;

alter table public.friends
  validate constraint friends_no_self_ck;

-- ---------------------------------------------------------------------------
-- Unique indexes for core social integrity
-- ---------------------------------------------------------------------------

create unique index if not exists workout_likes_user_workout_uidx
  on public.workout_likes (user_id, workout_id);

create unique index if not exists friends_user_pair_uidx
  on public.friends (user_low_id, user_high_id);

create unique index if not exists friend_requests_pending_pair_uidx
  on public.friend_requests (
    least(from_user_id, to_user_id),
    greatest(from_user_id, to_user_id)
  )
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Query-performance indexes (feed/social/stats/weight)
-- ---------------------------------------------------------------------------

create index if not exists workouts_user_start_time_idx
  on public.workouts (user_id, start_time desc);

create index if not exists workouts_user_completed_start_time_idx
  on public.workouts (user_id, start_time desc)
  where end_time is not null;

create index if not exists sets_workout_id_idx
  on public.sets (workout_id);

create index if not exists sets_exercise_id_workout_id_idx
  on public.sets (exercise_id, workout_id);

create index if not exists workout_exercises_workout_id_order_idx
  on public.workout_exercises (workout_id, "order");

create index if not exists template_exercises_template_id_order_idx
  on public.template_exercises (template_id, order_index);

create index if not exists workout_likes_workout_id_idx
  on public.workout_likes (workout_id);

create index if not exists workout_comments_workout_id_created_at_idx
  on public.workout_comments (workout_id, created_at desc);

create index if not exists friend_requests_to_user_status_created_at_idx
  on public.friend_requests (to_user_id, status, created_at desc);

create index if not exists friend_requests_from_user_status_created_at_idx
  on public.friend_requests (from_user_id, status, created_at desc);

create index if not exists friends_user_low_id_idx
  on public.friends (user_low_id);

create index if not exists friends_user_high_id_idx
  on public.friends (user_high_id);

create index if not exists body_measurements_user_measured_at_idx
  on public.body_measurements (user_id, measured_at desc);

create index if not exists body_measurements_user_created_at_idx
  on public.body_measurements (user_id, created_at desc);

commit;
