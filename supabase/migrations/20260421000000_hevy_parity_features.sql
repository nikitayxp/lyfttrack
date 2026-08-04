-- Hevy-parity feature additions.
-- Goals:
-- 1) Persistent per-exercise description (bio) editable anywhere.
-- 2) Per-workout notes snapshot on workout_exercises so historical workouts
--    keep the exact notes that existed when they were performed.
-- 3) Unilateral (left/right) side tracking on sets.
-- 4) Guarded cleanup helpers for wiping custom exercises and completed/draft
--    workouts (invoked manually via RPC; no destructive auto-runs here).
--
-- This migration is idempotent and safe to re-apply.

begin;

-- ---------------------------------------------------------------------------
-- exercises.description : persistent bio / setup notes
-- ---------------------------------------------------------------------------

alter table if exists public.exercises
  add column if not exists description text;

alter table if exists public.exercises
  drop constraint if exists exercises_description_length;

alter table if exists public.exercises
  add constraint exercises_description_length
  check (description is null or char_length(description) <= 1000);

-- ---------------------------------------------------------------------------
-- workout_exercises.notes : per-workout snapshot of the exercise description
-- so historical workouts preserve whatever was written at the time.
-- ---------------------------------------------------------------------------

alter table if exists public.workout_exercises
  add column if not exists notes text;

alter table if exists public.workout_exercises
  drop constraint if exists workout_exercises_notes_length;

alter table if exists public.workout_exercises
  add constraint workout_exercises_notes_length
  check (notes is null or char_length(notes) <= 1000);

-- ---------------------------------------------------------------------------
-- sets.side : unilateral tracking (both/left/right)
-- Default 'both' so existing rows remain valid and all existing client code
-- keeps working unchanged.
-- ---------------------------------------------------------------------------

alter table if exists public.sets
  add column if not exists side text not null default 'both';

alter table if exists public.sets
  drop constraint if exists sets_side_check;

alter table if exists public.sets
  add constraint sets_side_check
  check (side in ('both', 'left', 'right'));

create index if not exists sets_exercise_side_idx
  on public.sets (exercise_id, side);

-- ---------------------------------------------------------------------------
-- Cleanup RPCs.
-- These are *manual* helpers for administrative data resets. They are
-- intentionally security definer + gated on auth.uid() so only the caller's
-- own data is affected (no cross-tenant purge).
-- ---------------------------------------------------------------------------

create or replace function public.wipe_my_workouts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'must be authenticated';
  end if;

  with deleted as (
    delete from public.workouts
    where user_id = v_user
    returning 1
  )
  select count(*)::integer into v_deleted from deleted;

  return coalesce(v_deleted, 0);
end;
$$;

grant execute on function public.wipe_my_workouts() to authenticated;

create or replace function public.wipe_my_custom_exercises()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_deleted integer;
begin
  if v_user is null then
    raise exception 'must be authenticated';
  end if;

  with deleted as (
    delete from public.exercises
    where is_custom = true
      and created_by = v_user
    returning 1
  )
  select count(*)::integer into v_deleted from deleted;

  return coalesce(v_deleted, 0);
end;
$$;

grant execute on function public.wipe_my_custom_exercises() to authenticated;

commit;
