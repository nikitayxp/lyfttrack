/**
 * Restore exercises to pre-dataset-dump state:
 * - ~80 famous catalogue (from catalog-now.json)
 * - ~111 Hevy import customs (from all-exercises.json where is_custom)
 * Reverse the 53 promote remaps so history returns to those custom IDs.
 * Keep slim schema columns. Keep any leftover referenced orphans as public
 * so we never drop sets on the floor.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const OWNER = '8785aafa-daa6-4035-ae30-8f34f5f0c030';

const all = JSON.parse(fs.readFileSync(path.join(root, 'tmp', 'all-exercises.json'), 'utf8'));
const remapPreview = JSON.parse(fs.readFileSync(path.join(root, 'tmp', 'remap-preview.json'), 'utf8'));
const catalogNowRaw = fs.readFileSync(path.join(root, 'tmp', 'catalog-now.json'), 'utf8');
const catalogNow = JSON.parse(
  catalogNowRaw.slice(catalogNowRaw.indexOf('{'), catalogNowRaw.lastIndexOf('}') + 1)
).rows;

const customs = all.filter((e) => e.is_custom);
const seedNames = new Set(
  catalogNow.flatMap((r) => [r.name, r.name_en, r.name_pt].filter(Boolean).map((n) => n.toLowerCase().trim()))
);

const seedRows = all.filter(
  (e) =>
    !e.is_custom &&
    ([e.name, e.name_en, e.name_pt].some((n) => n && seedNames.has(n.toLowerCase().trim())))
);

// Deduplicate seed by preferred English name
const seedByKey = new Map();
for (const e of seedRows) {
  const key = (e.name_en || e.name || '').toLowerCase().trim();
  if (!key) continue;
  if (!seedByKey.has(key)) seedByKey.set(key, e);
}
const seeds = [...seedByKey.values()];

const keepIds = new Set([...customs.map((e) => e.id), ...seeds.map((e) => e.id)]);

function esc(v) {
  if (v == null || v === '') return 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function rowTuple(e, { custom }) {
  const name = (e.name_en || e.name || '').trim();
  const namePt = (e.name_pt || e.name || null) && (e.name_pt || e.name) !== name ? e.name_pt || e.name : e.name_pt || null;
  // For Hevy customs, keep the Portuguese title as `name` so the app shows what you imported.
  const displayName = custom ? e.name || name : name;
  const displayPt = custom ? e.name : namePt;
  return `  (${esc(e.id)}::uuid, ${esc(displayName)}, ${esc(displayPt)}, ${esc(e.muscle_group)}, ${esc(e.equipment)}, ${custom}, ${custom ? esc(OWNER) + '::uuid' : 'null'}, null)`;
}

const upsertRows = [
  ...seeds.map((e) => rowTuple(e, { custom: false })),
  ...customs.map((e) => rowTuple(e, { custom: true })),
];

const remapValues = remapPreview.remaps
  .map((r) => `  (${esc(r.custom_id)}::uuid, ${esc(r.catalog_id)}::uuid)`)
  .join(',\n');

const keepIdList = [...keepIds].map((id) => `  '${id}'::uuid`).join(',\n');

const sql = `-- Restore ~80 seed + ~111 Hevy customs (yesterday-ish state)
begin;

-- 1) Upsert seed + customs
insert into public.exercises (id, name, name_pt, muscle_group, equipment, is_custom, created_by, image_url)
values
${upsertRows.join(',\n')}
on conflict (id) do update set
  name = excluded.name,
  name_pt = excluded.name_pt,
  muscle_group = excluded.muscle_group,
  equipment = excluded.equipment,
  is_custom = excluded.is_custom,
  created_by = excluded.created_by;

-- 2) Reverse promote remaps: catalogue → original custom ids
create temporary table promote_reverse(custom_id uuid, catalog_id uuid) on commit drop;
insert into promote_reverse(custom_id, catalog_id) values
${remapValues};

update public.sets s
set exercise_id = p.custom_id
from promote_reverse p
where s.exercise_id = p.catalog_id;

delete from public.workout_exercises we
using promote_reverse p
where we.exercise_id = p.catalog_id
  and exists (
    select 1 from public.workout_exercises o
    where o.workout_id = we.workout_id and o.exercise_id = p.custom_id and o.id <> we.id
  );

update public.workout_exercises we
set exercise_id = p.custom_id
from promote_reverse p
where we.exercise_id = p.catalog_id
  and not exists (
    select 1 from public.workout_exercises o
    where o.workout_id = we.workout_id and o.exercise_id = p.custom_id and o.id <> we.id
  );

update public.template_exercises te
set exercise_id = p.custom_id
from promote_reverse p
where te.exercise_id = p.catalog_id;

update public.routine_exercises re
set exercise_id = p.custom_id
from promote_reverse p
where re.exercise_id = p.catalog_id;

-- 3) Any still-referenced exercise outside keep-set → keep as PUBLIC (don't lose history)
update public.exercises e
set is_custom = false,
    created_by = null
where e.id not in (${keepIdList})
  and (
    exists (select 1 from public.sets s where s.exercise_id = e.id)
    or exists (select 1 from public.workout_exercises we where we.exercise_id = e.id)
    or exists (select 1 from public.template_exercises te where te.exercise_id = e.id)
    or exists (select 1 from public.routine_exercises re where re.exercise_id = e.id)
  );

-- 4) Delete unreferenced junk (dataset dump leftovers)
delete from public.exercises e
where e.id not in (${keepIdList})
  and not exists (select 1 from public.sets s where s.exercise_id = e.id)
  and not exists (select 1 from public.workout_exercises we where we.exercise_id = e.id)
  and not exists (select 1 from public.template_exercises te where te.exercise_id = e.id)
  and not exists (select 1 from public.routine_exercises re where re.exercise_id = e.id);

-- 5) Re-assert flags on the intended sets
update public.exercises set is_custom = false, created_by = null
where id in (${seeds.map((e) => `'${e.id}'::uuid`).join(',')});

update public.exercises set is_custom = true, created_by = '${OWNER}'::uuid
where id in (${customs.map((e) => `'${e.id}'::uuid`).join(',')});

commit;

select
  count(*) as total,
  count(*) filter (where not is_custom) as catalog,
  count(*) filter (where is_custom) as custom
from public.exercises;
`;

fs.writeFileSync(path.join(root, 'tmp', 'restore-80-plus-hevy.sql'), sql);
fs.writeFileSync(
  path.join(root, 'tmp', 'restore-80-plus-hevy-preview.json'),
  JSON.stringify(
    {
      seeds: seeds.length,
      customs: customs.length,
      promoteRemapsReversed: remapPreview.remaps.length,
      seedNames: seeds.map((e) => e.name_en || e.name).sort(),
      customNames: customs.map((e) => e.name).sort(),
    },
    null,
    2
  )
);

console.log({
  seeds: seeds.length,
  customs: customs.length,
  promoteRemaps: remapPreview.remaps.length,
});
