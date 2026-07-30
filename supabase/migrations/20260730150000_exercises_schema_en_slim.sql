-- #108 slim exercises schema (EN-first)
-- Keep: id, name (EN), name_pt (nullable empty), muscle_group, equipment,
--        is_custom, created_by, image_url
-- Drop: name_en, muscle_en, muscle_pt, description

begin;

-- Canonical English name lives in `name`
update public.exercises
set name = coalesce(nullif(trim(name_en), ''), name)
where nullif(trim(name_en), '') is not null;

-- Portuguese names cleared for now (fill later by hand if wanted)
update public.exercises
set name_pt = null
where name_pt is not null;

alter table public.exercises drop column if exists name_en;
alter table public.exercises drop column if exists muscle_en;
alter table public.exercises drop column if exists muscle_pt;
alter table public.exercises drop column if exists description;

commit;
