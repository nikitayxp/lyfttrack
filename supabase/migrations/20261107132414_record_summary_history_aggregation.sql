create or replace function public.workout_record_summaries(p_workout_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  with targets as materialized (
    select w.id, w.user_id, w.start_time
    from public.workouts w
    where w.id = any(p_workout_ids)
  ), target_exercises as materialized (
    select distinct w.id, w.user_id, w.start_time, s.exercise_id
    from targets w
    join public.sets s on s.workout_id = w.id
    where s.exercise_id is not null
  ), bounds as (
    select t.user_id, t.exercise_id, max(t.start_time) as latest_start_time
    from target_exercises t
    group by t.user_id, t.exercise_id
  ), history as materialized (
    select w.user_id, s.exercise_id, w.start_time,
      count(s.id) as set_count,
      max(greatest(s.weight, 0)) as best_weight,
      max(case when s.weight > 0 and s.reps > 0
        then s.weight::double precision * (1::double precision + s.reps::double precision / 30::double precision)
        else 0 end) as best_e1rm
    from bounds b
    join public.workouts w on w.user_id = b.user_id
      and w.end_time is not null and w.start_time < b.latest_start_time
    join public.sets s on s.workout_id = w.id and s.exercise_id = b.exercise_id
    group by w.user_id, s.exercise_id, w.start_time
  ), summaries as (
    select t.id as workout_id, t.exercise_id,
      coalesce(sum(h.set_count), 0) > 0 as has_history,
      coalesce(max(h.best_weight), 0) as best_weight,
      coalesce(max(h.best_e1rm), 0) as best_e1rm
    from target_exercises t
    left join history h on h.user_id = t.user_id
      and h.exercise_id = t.exercise_id and h.start_time < t.start_time
    group by t.id, t.exercise_id
  )
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from summaries s;
$$;
