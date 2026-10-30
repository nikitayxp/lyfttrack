begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

lock table auth.users, public.exercises, public.workouts, public.routines,
  public.workout_templates, public.workout_exercises, public.sets,
  public.routine_exercises, public.template_exercises
  in share row exclusive mode;

do $$
begin
  if exists (
    select 1 from public.sets s
    join public.exercises e on e.id = s.exercise_id
    where e.is_custom and s.workout_id is null and s.workout_exercise_id is null
  ) then
    raise exception 'Cannot repair exercise references: an unowned set has no workout or block';
  end if;
end;
$$;

update public.sets s
set workout_id = coalesce(s.workout_id, we.workout_id),
    exercise_id = coalesce(s.exercise_id, we.exercise_id),
    workout_exercise_id = case
      when (s.workout_id is null or s.workout_id = we.workout_id)
        and (s.exercise_id is null or s.exercise_id = we.exercise_id) then we.id
      else null
    end
from public.workout_exercises we
where s.workout_exercise_id = we.id
  and (
    s.workout_id is null
    or s.workout_id is distinct from we.workout_id
    or (s.exercise_id is not null and s.exercise_id is distinct from we.exercise_id)
  );

create temporary table copied_exercise_references (
  original_id uuid not null,
  user_id uuid not null,
  copy_id uuid not null default gen_random_uuid(),
  primary key (original_id, user_id)
) on commit drop;

insert into copied_exercise_references (original_id, user_id)
select distinct refs.exercise_id, refs.user_id
from (
  select we.exercise_id, w.user_id
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id
  union
  select s.exercise_id, w.user_id
  from public.sets s
  join public.workouts w on w.id = s.workout_id
  union
  select re.exercise_id, r.user_id
  from public.routine_exercises re
  join public.routines r on r.id = re.routine_id
  union
  select te.exercise_id, wt.user_id
  from public.template_exercises te
  join public.workout_templates wt on wt.id = te.template_id
) refs
join public.exercises e on e.id = refs.exercise_id
where e.is_custom and e.created_by is distinct from refs.user_id;

insert into public.exercises (
  id, name, muscle_group, equipment, is_custom, created_by,
  name_pt, image_url, name_en, muscle_en, muscle_pt, description, aliases, listed
)
select m.copy_id, e.name, e.muscle_group, e.equipment, true, m.user_id,
  e.name_pt, e.image_url, e.name_en, e.muscle_en, e.muscle_pt, e.description,
  e.aliases, e.listed
from copied_exercise_references m
join public.exercises e on e.id = m.original_id;

update public.workout_exercises we
set exercise_id = m.copy_id
from public.workouts w, copied_exercise_references m
where w.id = we.workout_id and m.user_id = w.user_id
  and m.original_id = we.exercise_id;

update public.sets s
set exercise_id = m.copy_id
from public.workouts w, copied_exercise_references m
where w.id = s.workout_id and m.user_id = w.user_id
  and m.original_id = s.exercise_id;

update public.routine_exercises re
set exercise_id = m.copy_id
from public.routines r, copied_exercise_references m
where r.id = re.routine_id and m.user_id = r.user_id
  and m.original_id = re.exercise_id;

update public.template_exercises te
set exercise_id = m.copy_id
from public.workout_templates wt, copied_exercise_references m
where wt.id = te.template_id and m.user_id = wt.user_id
  and m.original_id = te.exercise_id;

alter policy sets_insert_owner_only on public.sets
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = sets.workout_id and w.user_id = (select auth.uid())
    )
    and (sets.exercise_id is null or public.can_reference_exercise(sets.exercise_id))
    and (
      sets.workout_exercise_id is null
      or exists (
        select 1 from public.workout_exercises we
        where we.id = sets.workout_exercise_id
          and we.workout_id = sets.workout_id
          and (sets.exercise_id is null or we.exercise_id = sets.exercise_id)
      )
    )
  );

alter policy sets_update_owner_only on public.sets
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = sets.workout_id and w.user_id = (select auth.uid())
    )
    and (sets.exercise_id is null or public.can_reference_exercise(sets.exercise_id))
    and (
      sets.workout_exercise_id is null
      or exists (
        select 1 from public.workout_exercises we
        where we.id = sets.workout_exercise_id
          and we.workout_id = sets.workout_id
          and (sets.exercise_id is null or we.exercise_id = sets.exercise_id)
      )
    )
  );

commit;
