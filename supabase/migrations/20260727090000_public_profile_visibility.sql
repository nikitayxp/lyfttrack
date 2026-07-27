-- ---------------------------------------------------------------------------
-- Make profiles.visibility authoritative for workout content (issue #51)
--
-- The column already accepted 'public' | 'friends' | 'private', but no policy
-- ever read it: workouts, workout_exercises and sets were all gated on
-- "self or friends". A profile set to public therefore behaved exactly like a
-- friends-only profile, which produced the broken middle state in the app —
-- a workout list that renders but whose details refuse to load.
--
-- This migration introduces a single helper used by every content policy, so
-- the three tables can no longer drift apart from each other.
-- ---------------------------------------------------------------------------

-- Older rows may predate the column default; treat NULL as the safer 'friends'
-- rather than silently publishing them.
alter table if exists public.profiles
  alter column visibility set default 'friends';

update public.profiles
set visibility = 'friends'
where visibility is null;

-- With no NULLs left, make the column NOT NULL so the policy predicate can
-- never silently fall through on a missing value.
alter table if exists public.profiles
  alter column visibility set not null;

-- ---------------------------------------------------------------------------
-- Visibility helper
--
-- security definer so the check can read profiles and friends regardless of
-- the caller's own policies, which keeps the predicate cheap and avoids
-- recursive policy evaluation. search_path is pinned per Supabase guidance.
-- ---------------------------------------------------------------------------

create or replace function public.can_view_user_content(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case
      when target_user_id is null then false
      when auth.uid() = target_user_id then true
      when exists (
        select 1
        from public.profiles p
        where p.id = target_user_id
          and p.visibility = 'public'
      ) then true
      when exists (
        select 1
        from public.profiles p
        where p.id = target_user_id
          and p.visibility = 'friends'
      ) and exists (
        select 1
        from public.friends f
        where f.user_low_id = least(auth.uid(), target_user_id)
          and f.user_high_id = greatest(auth.uid(), target_user_id)
      ) then true
      else false
    end;
$$;

-- security definer means the default PUBLIC grant would let anon call it too;
-- revoke first, then grant only to authenticated.
revoke all on function public.can_view_user_content(uuid) from public;
grant execute on function public.can_view_user_content(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- workouts
-- ---------------------------------------------------------------------------

drop policy if exists workouts_select_self_or_friends on public.workouts;
drop policy if exists workouts_select_visible on public.workouts;

create policy workouts_select_visible
  on public.workouts
  for select
  to authenticated
  using (public.can_view_user_content(workouts.user_id));

-- ---------------------------------------------------------------------------
-- workout_exercises
-- ---------------------------------------------------------------------------

drop policy if exists workout_exercises_select_workout_visible on public.workout_exercises;

create policy workout_exercises_select_workout_visible
  on public.workout_exercises
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = workout_exercises.workout_id
        and public.can_view_user_content(w.user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- sets
--
-- This is the table that produced "0 sets / 0 exercises" on visible cards: the
-- parent workout passed the policy while its sets did not.
-- ---------------------------------------------------------------------------

drop policy if exists sets_select_workout_visible on public.sets;

create policy sets_select_workout_visible
  on public.sets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = sets.workout_id
        and public.can_view_user_content(w.user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- workout_likes / workout_comments
--
-- Kept in step so a public workout can be liked and commented on, rather than
-- rendering interaction buttons that always fail.
-- ---------------------------------------------------------------------------

drop policy if exists workout_likes_select_workout_visible on public.workout_likes;

create policy workout_likes_select_workout_visible
  on public.workout_likes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = workout_likes.workout_id
        and public.can_view_user_content(w.user_id)
    )
  );

drop policy if exists workout_likes_insert_own_on_visible_workout on public.workout_likes;

create policy workout_likes_insert_own_on_visible_workout
  on public.workout_likes
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.workouts w
      where w.id = workout_likes.workout_id
        and public.can_view_user_content(w.user_id)
    )
  );

drop policy if exists workout_comments_select_workout_visible on public.workout_comments;

create policy workout_comments_select_workout_visible
  on public.workout_comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = workout_comments.workout_id
        and public.can_view_user_content(w.user_id)
    )
  );

drop policy if exists workout_comments_insert_own_on_visible_workout on public.workout_comments;

create policy workout_comments_insert_own_on_visible_workout
  on public.workout_comments
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.workouts w
      where w.id = workout_comments.workout_id
        and public.can_view_user_content(w.user_id)
    )
  );
