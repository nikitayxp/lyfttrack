begin;

create or replace function public.all_time_personal_records()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with best_sets as materialized (
    select distinct on (s.exercise_id) s.exercise_id, s.weight, w.start_time, w.end_time
    from public.workouts w join public.sets s on s.workout_id = w.id
    where w.user_id = (select auth.uid()) and w.end_time is not null and s.weight > 0
    order by s.exercise_id, s.weight desc, w.end_time desc
  )
  select coalesce(jsonb_agg(to_jsonb(record) order by record.id), '[]'::jsonb)
  from (
    select e.id, e.name, e.name_en, e.name_pt, e.muscle_group, e.muscle_en, e.muscle_pt,
      jsonb_build_array(jsonb_build_object('weight', b.weight,
        'workouts', jsonb_build_object('start_time', b.start_time, 'end_time', b.end_time))) as sets
    from best_sets b join public.exercises e on e.id = b.exercise_id
  ) record;
$$;

revoke all on function public.all_time_personal_records() from public, anon;
grant execute on function public.all_time_personal_records() to authenticated;

commit;
