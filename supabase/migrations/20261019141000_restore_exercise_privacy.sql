-- Restore the versioned custom-exercise ownership contract after deployed policy
-- drift. Only policies change; do not repeat the catalogue/data cleanup from
-- 20260727194500. Existing schema/auth baseline is required (see README.md).
begin;

drop policy if exists exercises_select_authenticated on public.exercises;
create policy exercises_select_authenticated
on public.exercises for select to authenticated
using (is_custom = false or created_by = (select auth.uid()));

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
