-- Security hardening migration.
-- Goals:
-- 1) Enable and enforce RLS across all app-facing tables.
-- 2) Provide atomic friend-request response flow (accept/reject).
-- 3) Keep profiles.updated_at synchronized on profile updates.

begin;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep profiles.updated_at fresh
-- ---------------------------------------------------------------------------

create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.touch_profiles_updated_at();

-- ---------------------------------------------------------------------------
-- Shared RPC: respond to friend requests atomically
-- ---------------------------------------------------------------------------

create or replace function public.respond_to_friend_request(
  p_request_id uuid,
  p_action text
)
returns setof public.friend_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_request public.friend_requests%rowtype;
  canonical_low uuid;
  canonical_high uuid;
  normalized_action text;
begin
  if actor_id is null then
    raise exception 'Authentication required.' using errcode = 'P0001';
  end if;

  normalized_action := lower(coalesce(btrim(p_action), ''));

  if normalized_action not in ('accepted', 'rejected') then
    raise exception 'Invalid action. Allowed values: accepted, rejected.' using errcode = 'P0001';
  end if;

  select *
  into target_request
  from public.friend_requests
  where id = p_request_id
    and to_user_id = actor_id
  for update;

  if not found then
    raise exception 'Friend request not found.' using errcode = 'P0001';
  end if;

  if target_request.status <> 'pending' then
    raise exception 'This friend request is no longer pending.' using errcode = 'P0001';
  end if;

  if normalized_action = 'accepted' then
    canonical_low := least(target_request.from_user_id, target_request.to_user_id);
    canonical_high := greatest(target_request.from_user_id, target_request.to_user_id);

    insert into public.friends (user_low_id, user_high_id, created_by_request_id)
    values (canonical_low, canonical_high, target_request.id)
    on conflict (user_low_id, user_high_id) do nothing;
  end if;

  return query
  update public.friend_requests
  set
    status = normalized_action,
    responded_at = timezone('utc'::text, now())
  where id = target_request.id
    and to_user_id = actor_id
    and status = 'pending'
  returning *;

  if not found then
    raise exception 'Unable to update friend request status.' using errcode = 'P0001';
  end if;
end;
$$;

grant execute on function public.respond_to_friend_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS canonical reset helper per table (drop all existing policies first)
-- ---------------------------------------------------------------------------

-- profiles
alter table if exists public.profiles enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', policy_record.policyname);
  end loop;
end;
$$;

create policy profiles_select_public
  on public.profiles
  for select
  to authenticated
  using (true);

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- exercises
alter table if exists public.exercises enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'exercises'
  loop
    execute format('drop policy if exists %I on public.exercises', policy_record.policyname);
  end loop;
end;
$$;

create policy exercises_select_authenticated
  on public.exercises
  for select
  to authenticated
  using (true);

create policy exercises_insert_own_custom
  on public.exercises
  for insert
  to authenticated
  with check (auth.uid() = created_by and is_custom = true);

create policy exercises_update_own_custom
  on public.exercises
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- friend_requests
alter table if exists public.friend_requests enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'friend_requests'
  loop
    execute format('drop policy if exists %I on public.friend_requests', policy_record.policyname);
  end loop;
end;
$$;

create policy friend_requests_select_own
  on public.friend_requests
  for select
  to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy friend_requests_insert_own
  on public.friend_requests
  for insert
  to authenticated
  with check (
    auth.uid() = from_user_id
    and to_user_id <> auth.uid()
    and status = 'pending'
  );

create policy friend_requests_update_recipient
  on public.friend_requests
  for update
  to authenticated
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

-- friends
alter table if exists public.friends enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'friends'
  loop
    execute format('drop policy if exists %I on public.friends', policy_record.policyname);
  end loop;
end;
$$;

create policy friends_select_own_network
  on public.friends
  for select
  to authenticated
  using (
    auth.uid() = user_low_id
    or auth.uid() = user_high_id
  );

create policy friends_insert_from_incoming_request
  on public.friends
  for insert
  to authenticated
  with check (
    (auth.uid() = user_low_id or auth.uid() = user_high_id)
    and exists (
      select 1
      from public.friend_requests fr
      where fr.to_user_id = auth.uid()
        and fr.status in ('pending', 'accepted')
        and least(fr.from_user_id, fr.to_user_id) = least(friends.user_low_id, friends.user_high_id)
        and greatest(fr.from_user_id, fr.to_user_id) = greatest(friends.user_low_id, friends.user_high_id)
    )
  );

-- workouts
alter table if exists public.workouts enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workouts'
  loop
    execute format('drop policy if exists %I on public.workouts', policy_record.policyname);
  end loop;
end;
$$;

create policy workouts_select_self_or_friends
  on public.workouts
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.friends f
      where f.user_low_id = least(auth.uid(), workouts.user_id)
        and f.user_high_id = greatest(auth.uid(), workouts.user_id)
    )
  );

create policy workouts_insert_own
  on public.workouts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy workouts_update_own
  on public.workouts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy workouts_delete_own
  on public.workouts
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- workout_exercises
alter table if exists public.workout_exercises enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_exercises'
  loop
    execute format('drop policy if exists %I on public.workout_exercises', policy_record.policyname);
  end loop;
end;
$$;

create policy workout_exercises_select_workout_visible
  on public.workout_exercises
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = workout_exercises.workout_id
        and (
          w.user_id = auth.uid()
          or exists (
            select 1
            from public.friends f
            where f.user_low_id = least(auth.uid(), w.user_id)
              and f.user_high_id = greatest(auth.uid(), w.user_id)
          )
        )
    )
  );

create policy workout_exercises_insert_owner_only
  on public.workout_exercises
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workouts w
      where w.id = workout_exercises.workout_id
        and w.user_id = auth.uid()
    )
  );

create policy workout_exercises_update_owner_only
  on public.workout_exercises
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = workout_exercises.workout_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workouts w
      where w.id = workout_exercises.workout_id
        and w.user_id = auth.uid()
    )
  );

create policy workout_exercises_delete_owner_only
  on public.workout_exercises
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = workout_exercises.workout_id
        and w.user_id = auth.uid()
    )
  );

-- sets
alter table if exists public.sets enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sets'
  loop
    execute format('drop policy if exists %I on public.sets', policy_record.policyname);
  end loop;
end;
$$;

create policy sets_select_workout_visible
  on public.sets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = sets.workout_id
        and (
          w.user_id = auth.uid()
          or exists (
            select 1
            from public.friends f
            where f.user_low_id = least(auth.uid(), w.user_id)
              and f.user_high_id = greatest(auth.uid(), w.user_id)
          )
        )
    )
  );

create policy sets_insert_owner_only
  on public.sets
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workouts w
      where w.id = sets.workout_id
        and w.user_id = auth.uid()
    )
  );

create policy sets_update_owner_only
  on public.sets
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = sets.workout_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workouts w
      where w.id = sets.workout_id
        and w.user_id = auth.uid()
    )
  );

create policy sets_delete_owner_only
  on public.sets
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = sets.workout_id
        and w.user_id = auth.uid()
    )
  );

-- workout_likes
alter table if exists public.workout_likes enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_likes'
  loop
    execute format('drop policy if exists %I on public.workout_likes', policy_record.policyname);
  end loop;
end;
$$;

create policy workout_likes_select_workout_visible
  on public.workout_likes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = workout_likes.workout_id
        and (
          w.user_id = auth.uid()
          or exists (
            select 1
            from public.friends f
            where f.user_low_id = least(auth.uid(), w.user_id)
              and f.user_high_id = greatest(auth.uid(), w.user_id)
          )
        )
    )
  );

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
        and (
          w.user_id = auth.uid()
          or exists (
            select 1
            from public.friends f
            where f.user_low_id = least(auth.uid(), w.user_id)
              and f.user_high_id = greatest(auth.uid(), w.user_id)
          )
        )
    )
  );

create policy workout_likes_delete_own
  on public.workout_likes
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- workout_comments
alter table if exists public.workout_comments enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_comments'
  loop
    execute format('drop policy if exists %I on public.workout_comments', policy_record.policyname);
  end loop;
end;
$$;

create policy workout_comments_select_workout_visible
  on public.workout_comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workouts w
      where w.id = workout_comments.workout_id
        and (
          w.user_id = auth.uid()
          or exists (
            select 1
            from public.friends f
            where f.user_low_id = least(auth.uid(), w.user_id)
              and f.user_high_id = greatest(auth.uid(), w.user_id)
          )
        )
    )
  );

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
        and (
          w.user_id = auth.uid()
          or exists (
            select 1
            from public.friends f
            where f.user_low_id = least(auth.uid(), w.user_id)
              and f.user_high_id = greatest(auth.uid(), w.user_id)
          )
        )
    )
  );

create policy workout_comments_update_own
  on public.workout_comments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy workout_comments_delete_own
  on public.workout_comments
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- routines
alter table if exists public.routines enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'routines'
  loop
    execute format('drop policy if exists %I on public.routines', policy_record.policyname);
  end loop;
end;
$$;

create policy routines_select_self_or_friends
  on public.routines
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.friends f
      where f.user_low_id = least(auth.uid(), routines.user_id)
        and f.user_high_id = greatest(auth.uid(), routines.user_id)
    )
  );

create policy routines_insert_own
  on public.routines
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy routines_update_own
  on public.routines
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy routines_delete_own
  on public.routines
  for delete
  to authenticated
  using (user_id = auth.uid());

-- routine_exercises
alter table if exists public.routine_exercises enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'routine_exercises'
  loop
    execute format('drop policy if exists %I on public.routine_exercises', policy_record.policyname);
  end loop;
end;
$$;

create policy routine_exercises_select_visible_routines
  on public.routine_exercises
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.routines r
      where r.id = routine_exercises.routine_id
        and (
          r.user_id = auth.uid()
          or exists (
            select 1
            from public.friends f
            where f.user_low_id = least(auth.uid(), r.user_id)
              and f.user_high_id = greatest(auth.uid(), r.user_id)
          )
        )
    )
  );

create policy routine_exercises_insert_owner_only
  on public.routine_exercises
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.routines r
      where r.id = routine_exercises.routine_id
        and r.user_id = auth.uid()
    )
  );

create policy routine_exercises_update_owner_only
  on public.routine_exercises
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.routines r
      where r.id = routine_exercises.routine_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.routines r
      where r.id = routine_exercises.routine_id
        and r.user_id = auth.uid()
    )
  );

create policy routine_exercises_delete_owner_only
  on public.routine_exercises
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.routines r
      where r.id = routine_exercises.routine_id
        and r.user_id = auth.uid()
    )
  );

-- workout_templates
alter table if exists public.workout_templates enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workout_templates'
  loop
    execute format('drop policy if exists %I on public.workout_templates', policy_record.policyname);
  end loop;
end;
$$;

create policy workout_templates_select_own
  on public.workout_templates
  for select
  to authenticated
  using (user_id = auth.uid());

create policy workout_templates_insert_own
  on public.workout_templates
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy workout_templates_update_own
  on public.workout_templates
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy workout_templates_delete_own
  on public.workout_templates
  for delete
  to authenticated
  using (user_id = auth.uid());

-- template_exercises
alter table if exists public.template_exercises enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'template_exercises'
  loop
    execute format('drop policy if exists %I on public.template_exercises', policy_record.policyname);
  end loop;
end;
$$;

create policy template_exercises_select_owner_templates
  on public.template_exercises
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workout_templates wt
      where wt.id = template_exercises.template_id
        and wt.user_id = auth.uid()
    )
  );

create policy template_exercises_insert_owner_templates
  on public.template_exercises
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workout_templates wt
      where wt.id = template_exercises.template_id
        and wt.user_id = auth.uid()
    )
  );

create policy template_exercises_update_owner_templates
  on public.template_exercises
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workout_templates wt
      where wt.id = template_exercises.template_id
        and wt.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_templates wt
      where wt.id = template_exercises.template_id
        and wt.user_id = auth.uid()
    )
  );

create policy template_exercises_delete_owner_templates
  on public.template_exercises
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workout_templates wt
      where wt.id = template_exercises.template_id
        and wt.user_id = auth.uid()
    )
  );

-- body_measurements
alter table if exists public.body_measurements enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'body_measurements'
  loop
    execute format('drop policy if exists %I on public.body_measurements', policy_record.policyname);
  end loop;
end;
$$;

create policy body_measurements_select_own
  on public.body_measurements
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy body_measurements_insert_own
  on public.body_measurements
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy body_measurements_update_own
  on public.body_measurements
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
