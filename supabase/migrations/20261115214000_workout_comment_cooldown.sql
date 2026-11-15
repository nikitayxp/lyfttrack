begin;

set local lock_timeout = '5s';
-- Account deletion reaches comments before profiles, the target of the new foreign key.
lock table public.workout_comments in share row exclusive mode;

create schema if not exists private;

create table if not exists private.workout_comment_cooldowns (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_created_at timestamptz not null
);

alter table private.workout_comment_cooldowns enable row level security;
revoke all on table private.workout_comment_cooldowns from public, anon, authenticated, service_role;

create or replace function private.set_workout_comment_created_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

revoke all on function private.set_workout_comment_created_at() from public, anon, authenticated, service_role;

create or replace function public.check_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The unique author row serializes concurrent comments, including on different workouts.
  insert into private.workout_comment_cooldowns as cooldown (user_id, last_created_at)
  values (new.user_id, new.created_at)
  on conflict (user_id) do update
  set last_created_at = excluded.last_created_at
  where cooldown.last_created_at <= excluded.last_created_at - interval '5 seconds';

  if not found then
    raise exception 'Spam detected: Please wait 5 seconds between comments.';
  end if;

  return null;
end;
$$;

revoke all on function public.check_comment_rate_limit() from public, anon, authenticated, service_role;

create or replace trigger tr_comment_created_at
before insert on public.workout_comments
for each row execute function private.set_workout_comment_created_at();

-- Only reserve the interval for rows accepted by the insert policy and actually inserted.
create or replace trigger tr_comment_rate_limit
after insert on public.workout_comments
for each row execute function public.check_comment_rate_limit();

-- Keep the remaining cooldown for recent comments across the trigger replacement.
with cutover as materialized (select pg_catalog.clock_timestamp() as at)
insert into private.workout_comment_cooldowns (user_id, last_created_at)
select user_id, max(created_at)
from public.workout_comments cross join cutover
where created_at > cutover.at - interval '5 seconds'
  and created_at <= cutover.at
group by user_id
on conflict (user_id) do nothing;

commit;
