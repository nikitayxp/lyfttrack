create or replace function public.workout_record_summaries(p_workout_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  with targets as (
    select w.id, w.user_id, w.start_time from public.workouts w
    where w.id = any(p_workout_ids)
  ), target_exercises as (
    select distinct w.id, w.user_id, w.start_time, s.exercise_id
    from targets w join public.sets s on s.workout_id = w.id
    where s.exercise_id is not null
  ), summaries as (
    select t.id as workout_id, t.exercise_id,
      count(s.id) > 0 as has_history,
      coalesce(max(greatest(s.weight,0)),0) as best_weight,
      coalesce(max(case when s.weight > 0 and s.reps > 0
        then s.weight::double precision * (1::double precision + s.reps::double precision / 30::double precision) else 0 end),0) as best_e1rm
    from target_exercises t
    left join public.workouts w on w.user_id = t.user_id
      and w.end_time is not null and w.start_time < t.start_time and w.id <> t.id
    left join public.sets s on s.workout_id = w.id and s.exercise_id = t.exercise_id
    group by t.id, t.exercise_id
  ) select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from summaries s;
$$;

create or replace function public.latest_workout_comments(p_workout_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
  from (select w.id as workout_id, latest.content, p.username as author
    from public.workouts w
    join lateral (
      select c.content, c.user_id from public.workout_comments c
      where c.workout_id = w.id order by c.created_at desc, c.id desc limit 1
    ) latest on true
    left join public.profiles p on p.id = latest.user_id
    where w.id = any(p_workout_ids)
  ) c;
$$;

create or replace function public.workout_month_buckets(p_user_id uuid, p_timezone text default 'UTC')
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(m) order by m.year desc, m.month desc), '[]'::jsonb)
  from (select extract(year from w.start_time at time zone p_timezone)::int as year,
      extract(month from w.start_time at time zone p_timezone)::int as month, count(*)::int as count
    from public.workouts w where w.user_id = p_user_id
    group by 1,2
  ) m;
$$;

create or replace function public.recent_candidate_activity(p_user_ids uuid[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(a) order by a.last_start_time desc, a.user_id), '[]'::jsonb)
  from (select w.user_id, max(w.start_time) as last_start_time
    from public.workouts w where w.user_id = any(p_user_ids) and w.end_time is not null
    group by w.user_id
  ) a;
$$;

revoke all on function public.workout_record_summaries(uuid[]) from public, anon;
revoke all on function public.latest_workout_comments(uuid[]) from public, anon;
revoke all on function public.workout_month_buckets(uuid,text) from public, anon;
revoke all on function public.recent_candidate_activity(uuid[]) from public, anon;
grant execute on function public.workout_record_summaries(uuid[]) to authenticated;
grant execute on function public.latest_workout_comments(uuid[]) to authenticated;
grant execute on function public.workout_month_buckets(uuid,text) to authenticated;
grant execute on function public.recent_candidate_activity(uuid[]) to authenticated;
create or replace function public.exercise_training_references(p_exercise_ids uuid[], p_excluded_workout_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with own_history as materialized (
    select s.id, s.exercise_id, s.workout_id, s.set_number, s.weight, s.reps, s.rir, s.set_type, w.start_time
    from public.sets s join public.workouts w on w.id = s.workout_id
    where w.user_id = (select auth.uid()) and w.end_time is not null
      and (p_excluded_workout_id is null or w.id <> p_excluded_workout_id)
      and s.exercise_id = any(p_exercise_ids)
  ), bests as (
    select h.exercise_id, coalesce(max(greatest(h.weight,0)),0) as best_weight,
      coalesce(max(case when h.weight > 0 and h.reps > 0 then h.weight::double precision * (1::double precision + h.reps::double precision / 30::double precision) else 0 end),0) as best_e1rm
    from own_history h group by h.exercise_id
  ), latest as (
    select distinct on(h.exercise_id) h.exercise_id, h.workout_id
    from own_history h order by h.exercise_id, h.start_time desc, h.workout_id desc
  ) select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (
    select e.exercise_id, coalesce(b.best_weight,0) as best_weight, coalesce(b.best_e1rm,0) as best_e1rm,
      coalesce((select jsonb_agg(jsonb_build_object('setNumber', h.set_number, 'weight', h.weight, 'reps', h.reps, 'rir', h.rir, 'setType', coalesce(h.set_type,'normal')) order by h.set_number, h.id)
        from own_history h join latest l on l.exercise_id=h.exercise_id and l.workout_id=h.workout_id
        where h.exercise_id=e.exercise_id), '[]'::jsonb) as last_sets,
      (select we.rest_time from public.workout_exercises we join public.workouts w on w.id=we.workout_id
        where we.exercise_id=e.exercise_id and w.user_id=(select auth.uid()) and w.end_time is not null
          and we.rest_time is not null
        order by w.start_time desc, w.id desc, we.id desc limit 1) as rest_time
    from (select distinct unnest(p_exercise_ids) as exercise_id) e
    left join bests b on b.exercise_id=e.exercise_id
  ) r;
$$;
revoke all on function public.exercise_training_references(uuid[],uuid) from public, anon;
grant execute on function public.exercise_training_references(uuid[],uuid) to authenticated;
create or replace function public.exercise_history_page(p_exercise_id uuid, p_limit integer default 20, p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.start_time desc, r.workout_id desc), '[]'::jsonb) from (
    select w.id as workout_id, w.start_time, jsonb_build_object('id',w.id,'name',w.name,'start_time',w.start_time,'end_time',w.end_time,'user_id',w.user_id) as workouts,
      (select coalesce(jsonb_agg(jsonb_build_object('set_number',s.set_number,'weight',s.weight,'reps',s.reps,'rir',s.rir,'set_type',s.set_type) order by s.set_number,s.id), '[]'::jsonb)
        from public.sets s where s.workout_id=w.id and s.exercise_id=p_exercise_id) as sets
    from public.workouts w
    where w.user_id=(select auth.uid()) and w.end_time is not null
      and exists(select 1 from public.sets s where s.workout_id=w.id and s.exercise_id=p_exercise_id)
    order by w.start_time desc,w.id desc
    limit greatest(1,least(coalesce(p_limit,20),100)) offset greatest(0,coalesce(p_offset,0))
  ) r;
$$;
revoke all on function public.exercise_history_page(uuid,integer,integer) from public, anon;
grant execute on function public.exercise_history_page(uuid,integer,integer) to authenticated;

create or replace function public.exercise_stats_summary(p_exercise_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with own_sets as materialized (
    select s.id, w.id as workout_id, (w.start_time at time zone 'UTC')::date as day,
      case when s.weight::text in ('NaN','Infinity','-Infinity') then 0::double precision
        else greatest(coalesce(s.weight,0),0)::double precision end as weight,
      greatest(coalesce(s.reps,0),0)::double precision as reps,
      s.rir, lower(btrim(coalesce(s.set_type,''))) = 'warmup' as is_warmup,
      greatest(0, floor((floor(extract(epoch from w.end_time)*1000)
        - floor(extract(epoch from w.start_time)*1000))/60000 + 0.5)) as duration_minutes
    from public.sets s join public.workouts w on w.id=s.workout_id
    where s.exercise_id=p_exercise_id and w.user_id=(select auth.uid()) and w.end_time is not null
  ), samples as materialized (
    select h.*, case when h.weight > 0 and h.reps > 0
      then h.weight * (1::double precision + (h.reps + case when h.rir >= 0 then h.rir::double precision else 0::double precision end) / 30::double precision)
      else 0::double precision end as e1rm
    from own_sets h
  ), workouts_per_day as (
    select day, sum(duration_minutes) as duration_minutes
    from (select distinct day,workout_id,duration_minutes from samples) w group by day
  ), heaviest as (
    select distinct on(day) day,weight,reps from samples where not is_warmup
    order by day,weight desc,reps desc
  ), days as (
    select s.day, sum(s.weight*s.reps order by s.id) as volume_total,
      sum(s.reps order by s.id) as reps_total,
      coalesce(max(s.e1rm) filter(where not s.is_warmup),0) as estimated_1rm_max
    from samples s where s.day is not null group by s.day
  ) select jsonb_build_object(
    'progress', coalesce((select jsonb_agg(jsonb_build_object(
      'date',d.day::text,'volumeTotal',d.volume_total,'repsTotal',d.reps_total,
      'durationMinutes',w.duration_minutes,'estimated1RMMax',d.estimated_1rm_max,
      'maxWeight',coalesce(h.weight,0),'maxWeightReps',coalesce(h.reps,0)) order by d.day)
      from days d join workouts_per_day w on w.day=d.day left join heaviest h on h.day=d.day), '[]'::jsonb),
    'records', (select jsonb_build_object('heaviestWeight',coalesce(max(s.weight),0),
      'bestEstimated1RM',coalesce(max(s.e1rm),0),'completedSetCount',count(*)) from samples s)
  );
$$;
revoke all on function public.exercise_stats_summary(uuid) from public, anon;
grant execute on function public.exercise_stats_summary(uuid) to authenticated;
