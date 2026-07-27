-- ---------------------------------------------------------------------------
-- Catalogue vs custom cleanup (issue #71)
--
-- 1. Test junk "Preacher Curl" (dumbbell custom) is remapped to the built-in
--    machine Rosca Scott / Preacher Curl, then deleted.
-- 2. Remaining rows wrongly marked is_custom are promoted to shared catalogue
--    (is_custom = false, created_by = null): public and not user-editable.
-- 3. RLS: custom exercises are private to their creator; catalogue stays
--    visible to every authenticated user. Own customs can be deleted.
-- ---------------------------------------------------------------------------

-- Official machine Preacher Curl / Rosca Scott
-- id: ac76b2eb-e405-46dd-9deb-cb2f7224940e
-- Test custom Preacher Curl (Dumbell)
-- id: f4ca449f-5d0a-4a2b-ba01-d63b0858dafa

do $$
declare
  canonical_id uuid := 'ac76b2eb-e405-46dd-9deb-cb2f7224940e';
  junk_id uuid := 'f4ca449f-5d0a-4a2b-ba01-d63b0858dafa';
begin
  if exists (select 1 from public.exercises where id = junk_id)
     and exists (select 1 from public.exercises where id = canonical_id) then
    update public.sets set exercise_id = canonical_id where exercise_id = junk_id;
    update public.workout_exercises set exercise_id = canonical_id where exercise_id = junk_id;
    update public.template_exercises set exercise_id = canonical_id where exercise_id = junk_id;
    update public.routine_exercises set exercise_id = canonical_id where exercise_id = junk_id;
    delete from public.exercises where id = junk_id;
  end if;
end;
$$;

-- Promote everything still marked custom to shared catalogue.
update public.exercises
set is_custom = false,
    created_by = null
where is_custom = true
   or created_by is not null;

-- Private customs going forward: catalogue for everyone, customs only for owner.
drop policy if exists exercises_select_authenticated on public.exercises;
create policy exercises_select_authenticated
  on public.exercises
  for select
  to authenticated
  using (is_custom = false or created_by = auth.uid());

-- Only the owner can update their own custom rows (tighten: require is_custom).
drop policy if exists exercises_update_own_custom on public.exercises;
create policy exercises_update_own_custom
  on public.exercises
  for update
  to authenticated
  using (is_custom = true and created_by = auth.uid())
  with check (is_custom = true and created_by = auth.uid());

drop policy if exists exercises_delete_own_custom on public.exercises;
create policy exercises_delete_own_custom
  on public.exercises
  for delete
  to authenticated
  using (is_custom = true and created_by = auth.uid());
