-- ---------------------------------------------------------------------------
-- Merge the Rosca Scott / Preacher Curl duplicates (issue #33)
--
-- The catalogue carried the same movement twice, once named in Portuguese and
-- once in English. They ranked as two different exercises, so history, PRs and
-- previous-performance lookups were split between them.
--
-- References are repointed to a canonical row and only the emptied duplicates
-- are removed, so no training history is lost in the merge.
--
-- Review feedback applied (PR #56):
--   * the bare names no longer force an equipment value. "Rosca Scott" with no
--     qualifier does not say whether it was barbell, dumbbell or machine, and
--     overwriting it with a guess would corrupt correct data. Equipment is only
--     set on rows whose name states it explicitly, and never overwrites a value
--     that is already there.
--   * 'preacher hammer dumbbell curl' was dropped from the alias list. A hammer
--     grip preacher curl is a different movement, not a synonym.
--
-- RUN THE PREVIEW QUERIES AT THE END OF THIS FILE BEFORE APPLYING.
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
  canonical_id uuid;
  duplicate_id uuid;
begin
  -- equipment is null for the unqualified group: those rows keep whatever
  -- equipment they already carry.
  for variant in
    select *
    from (
      values
        (
          'Rosca Scott',
          'Preacher Curl',
          null::text,
          array['rosca scott', 'preacher curl']
        ),
        (
          'Rosca Scott (Barra)',
          'Preacher Curl (Barbell)',
          'barbell',
          array[
            'rosca scott barra',
            'rosca scott com barra',
            'barbell preacher curl',
            'preacher curl barbell'
          ]
        ),
        (
          'Rosca Scott (Halter)',
          'Preacher Curl (Dumbbell)',
          'dumbbell',
          array[
            'rosca scott halter',
            'rosca scott com halter',
            'rosca scott halteres',
            'dumbbell preacher curl',
            'preacher curl dumbbell'
          ]
        ),
        (
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
    ) as v(name_pt, name_en, equipment, aliases)
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
        -- coalesce, never overwrite: an existing value is real data, and a null
        -- variant.equipment means the name does not tell us the equipment.
        equipment = coalesce(equipment, variant.equipment),
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
-- PREVIEW QUERIES — run these in staging before applying the block above.
--
-- 1. Everything the merge could touch, with real ids, equipment and reference
--    counts. Confirm every row listed is genuinely the same movement.
--
--   select e.id, e.name, e.name_en, e.name_pt, e.equipment, e.is_custom,
--          (select count(*) from public.sets s where s.exercise_id = e.id) as sets_count,
--          (select count(*) from public.workout_exercises we where we.exercise_id = e.id) as workout_refs,
--          (select count(*) from public.template_exercises te where te.exercise_id = e.id) as template_refs,
--          (select count(*) from public.routine_exercises re where re.exercise_id = e.id) as routine_refs
--   from public.exercises e
--   where public.lyft_normalize_exercise_name(e.name)    like '%scott%'
--      or public.lyft_normalize_exercise_name(e.name)    like '%preacher%'
--      or public.lyft_normalize_exercise_name(e.name_en) like '%preacher%'
--      or public.lyft_normalize_exercise_name(e.name_pt) like '%scott%'
--   order by sets_count desc;
--
-- 2. Which row wins as canonical for the unqualified group. Confirm this is the
--    one you expect to survive.
--
--   select e.id, e.name, e.equipment,
--          (select count(*) from public.sets s where s.exercise_id = e.id) as sets_count
--   from public.exercises e
--   where public.lyft_normalize_exercise_name(e.name)    in ('rosca scott', 'preacher curl')
--      or public.lyft_normalize_exercise_name(e.name_en) in ('rosca scott', 'preacher curl')
--      or public.lyft_normalize_exercise_name(e.name_pt) in ('rosca scott', 'preacher curl')
--   order by sets_count desc, e.created_at asc nulls last, e.id asc;
--
-- 3. Remaining PT/EN collisions elsewhere in the catalogue, to be reviewed one
--    at a time rather than merged blindly.
--
--   select a.id, a.name, b.id, b.name
--   from public.exercises a
--   join public.exercises b
--     on a.id < b.id
--    and public.lyft_normalize_exercise_name(a.name_en)
--        = public.lyft_normalize_exercise_name(b.name_en)
--   where a.name_en is not null;
-- ---------------------------------------------------------------------------
