-- Keep optional template links, and bind every non-null link to its owner.
begin;

set local lock_timeout = '5s';
lock table public.workouts, public.workout_templates in access exclusive mode nowait;

do $$
begin
  if exists (
    select 1 from public.workouts w
    left join public.workout_templates t on t.id = w.template_id
    where w.template_id is not null
      and (t.id is null or w.user_id is null or t.user_id is null or w.user_id <> t.user_id)
  ) then
    raise exception 'Existing workout template links need review before enforcing ownership';
  end if;
end;
$$;

alter table public.workout_templates
  add constraint workout_templates_id_user_id_key unique (id, user_id);

alter table public.workouts
  drop constraint workouts_template_id_fkey,
  add constraint workouts_template_id_fkey
    foreign key (template_id, user_id)
    references public.workout_templates (id, user_id)
    on delete set null (template_id);

commit;
