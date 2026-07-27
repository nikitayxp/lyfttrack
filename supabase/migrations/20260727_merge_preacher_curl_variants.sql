-- ---------------------------------------------------------------------------
-- Merge the Rosca Scott / Preacher Curl duplicates (issue #33)
--
-- The catalogue carried the same movement twice, once named in Portuguese and
-- once in English, with equipment folded into the name inconsistently. They
-- ranked as two different exercises, so history, PRs and previous-performance
-- lookups were split between them.
--
-- Rather than deleting one and losing its history, references are repointed to
-- a canonical row per equipment variant and only the emptied duplicates are
-- removed. The scope is deliberately an explicit list of names rather than a
-- fuzzy match: an automatic merge across the whole catalogue could silently
-- destroy someone's training history.
-- ---------------------------------------------------------------------------

-- Accent- and punctuation-insensitive comparison. unaccent is not guaranteed to
-- be installed on the project, so the mapping is spelled out.
create or replace function public.lyft_normalize_exercise_name(value text)
returns text
language sql
immutable
as $$
  select btrim(
    regexp_replace(
      lower(
        translate(
          coalesce(value, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
          'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
        )
      ),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

do $$
declare
  variant record;
  alias_name text;
  canonical_id uuid;
  duplicate_id uuid;
begin
  -- One row per equipment variant. Every alias listed collapses into it.
  for variant in
    select *
    from (
      values
        (
          'barbell',
          'Rosca Scott (Barra)',
          'Preacher Curl (Barbell)',
          'barbell',
          array[
            'rosca scott',
            'rosca scott barra',
            'rosca scott com barra',
            'preacher curl',
            'barbell preacher curl',
            'preacher curl barbell'
          ]
        ),
        (
          'dumbbell',
          'Rosca Scott (Halter)',
          'Preacher Curl (Dumbbell)',
          'dumbbell',
          array[
            'rosca scott halter',
            'rosca scott com halter',
            'rosca scott halteres',
            'dumbbell preacher curl',
            'preacher curl dumbbell',
            'preacher hammer dumbbell curl'
          ]
        ),
        (
          'machine',
          'Rosca Scott (Máquina)',
          'Preacher Curl (Machine)',
          'machine',
          array[
            'rosca scott maquina',
            'rosca scott na maquina',
            'machine preacher curl',
            'preacher curl machine'
          ]
        )
    ) as v(variant_key, name_pt, name_en, equipment, aliases)
  loop
    canonical_id := null;

    -- Prefer the row with the most logged sets, so the canonical row is the one
    -- users actually trained; ties fall back to the oldest row for determinism.
    select e.id
    into canonical_id
    from public.exercises e
    where public.lyft_normalize_exercise_name(e.name) = any (variant.aliases)
       or public.lyft_normalize_exercise_name(e.name_en) = any (variant.aliases)
       or public.lyft_normalize_exercise_name(e.name_pt) = any (variant.aliases)
    order by
      (select count(*) from public.sets s where s.exercise_id = e.id) desc,
      e.created_at asc nulls last,
      e.id asc
    limit 1;

    if canonical_id is null then
      continue;
    end if;

    update public.exercises
    set name = variant.name_pt,
        name_pt = variant.name_pt,
        name_en = variant.name_en,
        equipment = variant.equipment,
        muscle_group = coalesce(muscle_group, 'biceps'),
        muscle_pt = coalesce(muscle_pt, 'Bíceps'),
        muscle_en = coalesce(muscle_en, 'Biceps')
    where id = canonical_id;

    -- Repoint everything that referenced a duplicate, then drop the empty row.
    for duplicate_id in
      select e.id
      from public.exercises e
      where e.id <> canonical_id
        and (
          public.lyft_normalize_exercise_name(e.name) = any (variant.aliases)
          or public.lyft_normalize_exercise_name(e.name_en) = any (variant.aliases)
          or public.lyft_normalize_exercise_name(e.name_pt) = any (variant.aliases)
        )
    loop
      update public.sets set exercise_id = canonical_id where exercise_id = duplicate_id;
      update public.workout_exercises set exercise_id = canonical_id where exercise_id = duplicate_id;
      update public.template_exercises set exercise_id = canonical_id where exercise_id = duplicate_id;
      update public.routine_exercises set exercise_id = canonical_id where exercise_id = duplicate_id;

      delete from public.exercises where id = duplicate_id;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Finding the remaining duplicates
--
-- This migration only fixes the pair that was reported. Run the query below to
-- list other exercises whose Portuguese and English names collide, so they can
-- be reviewed one at a time instead of merged blindly:
--
--   select a.id, a.name, b.id, b.name
--   from public.exercises a
--   join public.exercises b
--     on a.id < b.id
--    and public.lyft_normalize_exercise_name(a.name_en)
--        = public.lyft_normalize_exercise_name(b.name_en)
--   where a.name_en is not null;
-- ---------------------------------------------------------------------------
