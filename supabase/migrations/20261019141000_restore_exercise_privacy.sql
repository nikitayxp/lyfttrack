-- Restore custom-exercise ownership after deployed policy drift. Catalogue rows
-- stay public. A custom row stays private to its owner unless that exercise is
-- already inside a workout the viewer can open. Writes stay owner-only.
-- Does not repeat the catalogue cleanup from 20260727194500.
begin;

create index if not exists workout_exercises_exercise_id_idx
  on public.workout_exercises (exercise_id);

drop policy if exists exercises_select_authenticated on public.exercises;
create policy exercises_select_authenticated
on public.exercises for select to authenticated
using (
  is_custom = false
  or created_by = (select auth.uid())
  or exists (
    select 1
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.exercise_id = public.exercises.id
      and public.can_view_user_content(w.user_id)
  )
);

drop policy if exists exercises_insert_own_custom on public.exercises;
create policy exercises_insert_own_custom
on public.exercises for insert to authenticated
with check (is_custom = true and created_by = (select auth.uid()));

drop policy if exists exercises_update_own_custom on public.exercises;
create policy exercises_update_own_custom
on public.exercises for update to authenticated
using (is_custom = true and created_by = (select auth.uid()))
with check (is_custom = true and created_by = (select auth.uid()));

drop policy if exists exercises_delete_own_custom on public.exercises;
create policy exercises_delete_own_custom
on public.exercises for delete to authenticated
using (is_custom = true and created_by = (select auth.uid()));

commit;
