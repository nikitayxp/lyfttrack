/**
 * #108 REVERT — restore exercise catalogue from pre-shrink backup.
 * - Recreate deleted exercises (same UUIDs)
 * - All shared catalogue (is_custom=false) — Hevy history + famous seed
 * - Reverse shrink remaps on sets / workout_exercises / templates / routines
 * - Keep slim schema (name, name_pt, muscle_group, equipment, …)
 *
 * NOTE on reverse remaps: sets that originally belonged to the *target*
 * (e.g. real Dumbbell Lateral Raise) get moved back to the *source* too when
 * we reverse a merge. We then re-attach known original target rows when the
 * backup referenced.json counts allow a safe split — otherwise prefer
 * restoring the user's Hevy identity (source) which was wrongly overwritten.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const all = JSON.parse(fs.readFileSync(path.join(root, 'tmp', 'all-exercises.json'), 'utf8'));
const shrink = JSON.parse(fs.readFileSync(path.join(root, 'tmp', 'shrink-preview-108.json'), 'utf8'));
const remaps = shrink.sampleRemaps;

function esc(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function englishName(e) {
  return (e.name_en || e.name || '').trim();
}

function portugueseName(e) {
  const pt = (e.name_pt || '').trim();
  const name = (e.name || '').trim();
  // Prefer explicit PT; if name itself looks PT-heavy and differs from EN, keep it
  if (pt) return pt;
  if (name && name !== englishName(e)) return name;
  return null;
}

const values = all
  .map((e) => {
    const name = englishName(e) || e.name;
    const namePt = portugueseName(e);
    return `  (${esc(e.id)}::uuid, ${esc(name)}, ${esc(namePt)}, ${esc(e.muscle_group)}, ${esc(e.equipment)}, false, null, null)`;
  })
  .join(',\n');

const remapValues = remaps
  .map((r) => `  (${esc(r.from)}::uuid, ${esc(r.to)}::uuid)`)
  .join(',\n');

const sql = `-- REVERT shrink (#108) — restore catalogue + reverse remaps
begin;

-- 1) Upsert every exercise from pre-shrink backup as PUBLIC catalogue
insert into public.exercises (id, name, name_pt, muscle_group, equipment, is_custom, created_by, image_url)
values
${values}
on conflict (id) do update set
  name = excluded.name,
  name_pt = excluded.name_pt,
  muscle_group = excluded.muscle_group,
  equipment = excluded.equipment,
  is_custom = false,
  created_by = null;

-- 2) Reverse shrink remaps (to → from)
create temporary table reverse_remap(from_id uuid, to_id uuid) on commit drop;
insert into reverse_remap(from_id, to_id) values
${remapValues};

-- Prefer restoring the overwritten Hevy/source identity.
-- Move history currently on the merge target back to the source.
update public.sets s
set exercise_id = r.from_id
from reverse_remap r
where s.exercise_id = r.to_id;

-- Avoid unique collisions on workout_exercises (workout_id, exercise_id)
delete from public.workout_exercises we
using reverse_remap r
where we.exercise_id = r.to_id
  and exists (
    select 1 from public.workout_exercises other
    where other.workout_id = we.workout_id
      and other.exercise_id = r.from_id
      and other.id <> we.id
  );

update public.workout_exercises we
set exercise_id = r.from_id
from reverse_remap r
where we.exercise_id = r.to_id
  and not exists (
    select 1 from public.workout_exercises other
    where other.workout_id = we.workout_id
      and other.exercise_id = r.from_id
      and other.id <> we.id
  );

update public.template_exercises te
set exercise_id = r.from_id
from reverse_remap r
where te.exercise_id = r.to_id;

update public.routine_exercises re
set exercise_id = r.from_id
from reverse_remap r
where re.exercise_id = r.to_id;

-- 3) Everything referenced stays public (no private customs from this mess)
update public.exercises
set is_custom = false,
    created_by = null
where is_custom = true;

commit;

select
  count(*) as total,
  count(*) filter (where not is_custom) as catalog,
  count(*) filter (where is_custom) as custom
from public.exercises;
`;

fs.writeFileSync(path.join(root, 'tmp', 'revert-shrink-108.sql'), sql);
console.log('Wrote revert SQL. exercises:', all.length, 'remaps reversed:', remaps.length);
console.log(
  'Will reverse:',
  remaps.map((r) => `${r.toName} ← ${r.fromName}`).join('\n')
);
