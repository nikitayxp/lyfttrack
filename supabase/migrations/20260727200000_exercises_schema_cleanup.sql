-- ---------------------------------------------------------------------------
-- exercises readability + normalize (issue #78)
--
-- Contract (also stored as column comments):
--   name          = canonical English mirror for catalogue (= name_en);
--                   for customs, the user-facing label
--   name_en/pt    = display names
--   muscle_group  = stable filter key (chest, back, …) when known
--   muscle_en/pt  = human labels (fallback / inference)
--   equipment     = stable filter key (barbell, dumbbell, …) when known
--   is_custom     = catalogue (false) vs user-owned (true)
--   created_by    = owner of a custom row; NULL on catalogue
-- ---------------------------------------------------------------------------

comment on table public.exercises is
  'Exercise catalogue (shared) and per-user customs. Catalogue: is_custom=false, created_by=null. Customs: is_custom=true, created_by=owner; private via RLS.';

comment on column public.exercises.name is
  'Canonical label. Catalogue: keep in sync with name_en. Customs: the name the user typed.';
comment on column public.exercises.name_en is
  'English display name.';
comment on column public.exercises.name_pt is
  'Portuguese display name.';
comment on column public.exercises.muscle_group is
  'Stable muscle key for filters (chest, back, shoulders, biceps, …). Prefer lowercase keys.';
comment on column public.exercises.muscle_en is
  'English muscle label (fallback when key is missing or non-standard).';
comment on column public.exercises.muscle_pt is
  'Portuguese muscle label (fallback when key is missing or non-standard).';
comment on column public.exercises.equipment is
  'Stable equipment key for filters (barbell, dumbbell, machine, cable, bodyweight, kettlebell).';
comment on column public.exercises.is_custom is
  'false = shared catalogue (public, not user-editable); true = user custom (private, editable, deletable).';
comment on column public.exercises.created_by is
  'Owner of a custom exercise. Must be null for catalogue rows.';
comment on column public.exercises.image_url is
  'Optional override image URL. Null falls back to free-exercise-db matching by name.';
comment on column public.exercises.description is
  'Optional notes/description; may seed workout_exercises.notes when starting a workout.';

-- Normalise casing / known typos on equipment
update public.exercises
set equipment = lower(btrim(equipment))
where equipment is not null
  and equipment <> lower(btrim(equipment));

update public.exercises
set equipment = 'dumbbell'
where lower(btrim(equipment)) in ('dumbell', 'dumbbells', 'halter', 'halteres');

update public.exercises
set equipment = 'barbell'
where lower(btrim(equipment)) in ('barra', 'olympic_barbell');

update public.exercises
set equipment = 'machine'
where lower(btrim(equipment)) in ('maquina', 'smith', 'smith_machine');

update public.exercises
set equipment = 'cable'
where lower(btrim(equipment)) in ('polia');

update public.exercises
set equipment = 'bodyweight'
where lower(btrim(equipment)) in ('body_weight', 'peso_corporal', 'peso corporal', 'calistenia', 'sem_equipamento');

-- Normalise muscle_group casing
update public.exercises
set muscle_group = lower(btrim(muscle_group))
where muscle_group is not null
  and muscle_group <> lower(btrim(muscle_group));

-- Catalogue: keep name mirrored to name_en when English is present
update public.exercises
set name = name_en
where is_custom = false
  and name_en is not null
  and btrim(name_en) <> ''
  and name is distinct from name_en;

-- Fill missing muscle labels from known keys (best-effort; never overwrite non-empty)
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Chest'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Peito')
where muscle_group = 'chest';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Back'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Costas')
where muscle_group = 'back';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Shoulders'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Ombros')
where muscle_group = 'shoulders';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Biceps'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Biceps')
where muscle_group = 'biceps';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Triceps'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Triceps')
where muscle_group = 'triceps';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Forearms'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Antebracos')
where muscle_group = 'forearms';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Quadriceps'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Quadriceps')
where muscle_group = 'quadriceps';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Hamstrings'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Posteriores')
where muscle_group = 'hamstrings';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Glutes'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Gluteos')
where muscle_group = 'glutes';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Calves'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Gemeos')
where muscle_group = 'calves';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Core'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Core')
where muscle_group = 'core';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Arms'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Bracos')
where muscle_group = 'arms';
update public.exercises set
  muscle_en = coalesce(nullif(btrim(muscle_en), ''), 'Legs'),
  muscle_pt = coalesce(nullif(btrim(muscle_pt), ''), 'Pernas')
where muscle_group = 'legs';

-- Ownership invariants
alter table public.exercises drop constraint if exists exercises_custom_owner_chk;
alter table public.exercises
  add constraint exercises_custom_owner_chk
  check (
    (is_custom = true and created_by is not null)
    or (is_custom = false and created_by is null)
  );

create index if not exists exercises_is_custom_created_by_idx
  on public.exercises (is_custom, created_by);
