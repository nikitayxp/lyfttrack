/**
 * #108 — Shrink catalogue to famous gym seed; keep used orphans as private customs.
 *
 * 1) Remap referenced rows onto famous seed via aliases when possible
 * 2) Mark remaining referenced non-seed rows as is_custom for the owner
 * 3) Delete every unused non-seed catalogue row (the dataset dump)
 * 4) Null bad name_pt on shared catalogue; ensure name = English
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const OWNER = '8785aafa-daa6-4035-ae30-8f34f5f0c030'; // Nikita test account (only customs creator)

const FAMOUS_EN = [
  'Barbell Bench Press',
  'Incline Barbell Bench Press',
  'Decline Barbell Bench Press',
  'Dumbbell Bench Press',
  'Incline Dumbbell Bench Press',
  'Dumbbell Fly',
  'Cable Chest Fly',
  'Cable Crossover',
  'Pec Deck Fly',
  'Machine Chest Press',
  'Push Up',
  'Chest Dip',
  'Pull Up',
  'Chin Up',
  'Lat Pulldown',
  'Wide Grip Lat Pulldown',
  'Seated Cable Row',
  'One Arm Dumbbell Row',
  'Barbell Bent Over Row',
  'T Bar Row',
  'Chest Supported Row',
  'Straight Arm Pulldown',
  'Deadlift',
  'Rack Pull',
  'Back Squat',
  'Front Squat',
  'Leg Press',
  'Hack Squat',
  'Bulgarian Split Squat',
  'Walking Lunge',
  'Leg Extension',
  'Leg Curl',
  'Romanian Deadlift',
  'Hip Thrust',
  'Glute Bridge',
  'Standing Calf Raise',
  'Seated Calf Raise',
  'Kettlebell Goblet Squat',
  'Barbell Overhead Press',
  'Seated Dumbbell Shoulder Press',
  'Arnold Press',
  'Dumbbell Lateral Raise',
  'Cable Lateral Raise',
  'Front Raise',
  'Rear Delt Fly',
  'Reverse Pec Deck',
  'Upright Row',
  'Face Pull',
  'Barbell Curl',
  'Dumbbell Curl',
  'Hammer Curl',
  'Preacher Curl',
  'Cable Curl',
  'Concentration Curl',
  'Skull Crusher',
  'Triceps Pushdown',
  'Overhead Triceps Extension',
  'Close Grip Bench Press',
  'Rope Triceps Pushdown',
  'Bench Dip',
  'Plank',
  'Side Plank',
  'Crunch',
  'Reverse Crunch',
  'Hanging Leg Raise',
  'Cable Crunch',
  'Ab Wheel Rollout',
  'Russian Twist',
  'Mountain Climber',
  'Dead Bug',
  // High-use gym standards present in DB but outside the original short seed
  'Machine Shoulder Press',
  'Hyperextension',
  'Cable Rope Overhead Triceps Extension',
];

/** normalizeKey(hevy/pt/dataset name) → famous English name */
const ALIAS_TO_FAMOUS = {
  'barbell bench press': 'Barbell Bench Press',
  'bench press': 'Barbell Bench Press',
  'supino barra': 'Barbell Bench Press',
  'supino reto com barra': 'Barbell Bench Press',
  'dumbbell bench press': 'Dumbbell Bench Press',
  'supino halter': 'Dumbbell Bench Press',
  'incline dumbbell bench press': 'Incline Dumbbell Bench Press',
  'supino inclinado halter': 'Incline Dumbbell Bench Press',
  'machine chest press': 'Machine Chest Press',
  'supino sentado maquina': 'Machine Chest Press',
  'supino inclinado na maquina': 'Machine Chest Press',
  'pec deck fly': 'Pec Deck Fly',
  'pec deck butterfly': 'Pec Deck Fly',
  'butterfly': 'Pec Deck Fly',
  'crucifixo na maquina': 'Pec Deck Fly',
  'cable chest fly': 'Cable Chest Fly',
  'crucifixo na polia maquina': 'Cable Chest Fly',
  'crucifixo baixo na polia maquina': 'Cable Chest Fly',
  'lat pulldown': 'Lat Pulldown',
  'puxada alta maquina': 'Lat Pulldown',
  'puxada alta na polia maquina': 'Lat Pulldown',
  'puxada alta pegada triangulo': 'Lat Pulldown',
  'seated cable row': 'Seated Cable Row',
  'remo sentado maquina': 'Seated Cable Row',
  't bar row': 'T Bar Row',
  'remada t bar': 'T Bar Row',
  'barbell bent over row': 'Barbell Bent Over Row',
  'remada barra': 'Barbell Bent Over Row',
  'remadas dobradas barra': 'Barbell Bent Over Row',
  'pull up': 'Pull Up',
  'barra fixa': 'Pull Up',
  'barra fixa com peso': 'Pull Up',
  'weighted pull up': 'Pull Up',
  'back squat': 'Back Squat',
  'agachamento barra': 'Back Squat',
  'agachamento livre': 'Back Squat',
  'hack squat': 'Hack Squat',
  'agachamento hack maquina': 'Hack Squat',
  'leg press': 'Leg Press',
  'leg press 45 maquina': 'Leg Press',
  'leg press horizontal maquina': 'Leg Press',
  'leg extension': 'Leg Extension',
  'cadeira extensora maquina': 'Leg Extension',
  'leg curl': 'Leg Curl',
  'cadeira flexora maquina': 'Leg Curl',
  'mesa flexora maquina': 'Leg Curl',
  'romanian deadlift': 'Romanian Deadlift',
  'peso morto com pernas esticadas': 'Romanian Deadlift',
  'hip thrust': 'Hip Thrust',
  'elevacao pelvica barra': 'Hip Thrust',
  'standing calf raise': 'Standing Calf Raise',
  'elevacao de panturrilha em pe maquina': 'Standing Calf Raise',
  'seated calf raise': 'Seated Calf Raise',
  'elevacao de panturrilha sentado maquina': 'Seated Calf Raise',
  'seated dumbbell shoulder press': 'Seated Dumbbell Shoulder Press',
  'press de ombros sentada halter': 'Seated Dumbbell Shoulder Press',
  'machine shoulder press': 'Machine Shoulder Press',
  'desenvolvimento de ombros maquina de placas': 'Machine Shoulder Press',
  'prensa de ombros sentada maquina': 'Machine Shoulder Press',
  'dumbbell lateral raise': 'Dumbbell Lateral Raise',
  'elevacao lateral halter': 'Dumbbell Lateral Raise',
  'cable lateral raise': 'Cable Lateral Raise',
  'elevacao lateral cabo': 'Cable Lateral Raise',
  'front raise': 'Front Raise',
  'elevacao frontal halter': 'Front Raise',
  'elevacao frontal cabo': 'Front Raise',
  'cable front raise': 'Front Raise',
  'reverse pec deck': 'Reverse Pec Deck',
  'aberturas invertidas de ombro posterior na maquina': 'Reverse Pec Deck',
  'dumbbell preacher curl': 'Preacher Curl',
  'barbell preacher curl': 'Preacher Curl',
  'preacher curl': 'Preacher Curl',
  'rosca scott halter': 'Preacher Curl',
  'rosca scott barra': 'Preacher Curl',
  'rosca scott maquina': 'Preacher Curl',
  'hammer curl': 'Hammer Curl',
  'dumbbell hammer curl': 'Hammer Curl',
  'rosca martelo halter': 'Hammer Curl',
  'dumbbell curl': 'Dumbbell Curl',
  'rosca direta halter': 'Dumbbell Curl',
  'cable curl': 'Cable Curl',
  'rosca direta na polia': 'Cable Curl',
  'triceps pushdown': 'Triceps Pushdown',
  'triceps na polia': 'Triceps Pushdown',
  'rope triceps pushdown': 'Rope Triceps Pushdown',
  'triceps na polia com corda': 'Rope Triceps Pushdown',
  'skull crusher': 'Skull Crusher',
  'triceps testa barra': 'Skull Crusher',
  'cable one arm tricep extension': 'Overhead Triceps Extension',
  'overhead triceps extension': 'Overhead Triceps Extension',
  'hyperextension': 'Hyperextension',
  // not in famous list — map to closest or leave custom
  'extensao lombar maquina': 'Hyperextension',
  'hiperextensao reversa': 'Hyperextension',
  'cable crunch': 'Cable Crunch',
  'abdominal na maquina': 'Cable Crunch',
  'decline crunch': 'Crunch',
  'abdominal declinado com peso': 'Crunch',
  'straight arm pulldown': 'Straight Arm Pulldown',
  'puxada com o braco reto corda': 'Straight Arm Pulldown',
  'chest dip': 'Chest Dip',
  'triceps na paralela com peso': 'Chest Dip',
  'side lateral raise machine': 'Dumbbell Lateral Raise',
  'lateral raise': 'Dumbbell Lateral Raise',
  'squat': 'Back Squat',
  'machine shoulder press': 'Machine Shoulder Press',
  'desenvolvimento de ombros maquina de placas': 'Machine Shoulder Press',
  'prensa de ombros sentada maquina': 'Machine Shoulder Press',
  'cable rope overhead triceps extension': 'Cable Rope Overhead Triceps Extension',
  'tricep corda extensao cabeca': 'Cable Rope Overhead Triceps Extension',
  'hyperextension': 'Hyperextension',
  'extensao lombar maquina': 'Hyperextension',
  'hiperextensao reversa': 'Hyperextension',
};

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/º/g, 'o')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function queryJson(sqlFile) {
  const buf = execSync(`npx supabase db query --linked -o json -f ${sqlFile}`, {
    cwd: root,
    maxBuffer: 50 * 1024 * 1024,
  });
  const t = buf.toString('utf8');
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)).rows;
}

fs.writeFileSync(
  path.join(root, 'tmp', 'export-all-ex.sql'),
  'select id, name, name_en, name_pt, is_custom, muscle_group, equipment from public.exercises;\n'
);
fs.writeFileSync(
  path.join(root, 'tmp', 'export-ref-ids.sql'),
  `select distinct exercise_id as id from (
    select exercise_id from public.sets
    union select exercise_id from public.workout_exercises
    union select exercise_id from public.template_exercises
    union select exercise_id from public.routine_exercises
  ) x;\n`
);

const all = queryJson('tmp/export-all-ex.sql');
const refIds = new Set(queryJson('tmp/export-ref-ids.sql').map((r) => r.id));

const byNormName = new Map();
for (const e of all) {
  for (const n of [e.name, e.name_en, e.name_pt]) {
    if (!n) continue;
    const k = normalizeKey(n);
    // Prefer exact famous English rows as targets
    const existing = byNormName.get(k);
    if (!existing || FAMOUS_EN.includes(e.name) || FAMOUS_EN.includes(e.name_en)) {
      byNormName.set(k, e);
    }
  }
}

const famousRows = all.filter(
  (e) => FAMOUS_EN.includes(e.name) || FAMOUS_EN.includes(e.name_en ?? '')
);
const famousByEn = new Map();
for (const e of famousRows) {
  const en = e.name_en || e.name;
  if (FAMOUS_EN.includes(en)) famousByEn.set(en, e);
}

const remaps = [];
const keepCustom = [];
const keepFamous = new Set(famousRows.map((e) => e.id));

for (const e of all) {
  if (!refIds.has(e.id)) continue;
  if (keepFamous.has(e.id)) continue;

  const keys = [e.name, e.name_en, e.name_pt].filter(Boolean).map(normalizeKey);
  let target = null;
  for (const k of keys) {
    const alias = ALIAS_TO_FAMOUS[k];
    if (alias && famousByEn.has(alias)) {
      target = famousByEn.get(alias);
      break;
    }
    // direct match to famous name
    if (famousByEn.has(e.name) || famousByEn.has(e.name_en)) {
      target = famousByEn.get(e.name) || famousByEn.get(e.name_en);
      break;
    }
  }

  if (target && target.id !== e.id) {
    remaps.push({ from: e.id, to: target.id, fromName: e.name, toName: target.name });
  } else if (!keepFamous.has(e.id)) {
    keepCustom.push(e);
  }
}

const referencedIds = new Set([...keepFamous, ...keepCustom.map((e) => e.id), ...remaps.map((r) => r.to)]);
// after remap, sources can be deleted if unused — handled in SQL

const deleteCandidates = all.filter((e) => !refIds.has(e.id) && !keepFamous.has(e.id));

const sql = `-- #108 shrink catalogue
begin;

-- 1) Remap history onto famous seed
${
  remaps.length
    ? `create temporary table remap(from_id uuid, to_id uuid) on commit drop;
insert into remap(from_id, to_id) values
${remaps.map((r) => `  ('${r.from}'::uuid, '${r.to}'::uuid)`).join(',\n')};

delete from public.workout_exercises we
using remap r
where we.exercise_id = r.from_id
  and exists (
    select 1 from public.workout_exercises o
    where o.workout_id = we.workout_id and o.exercise_id = r.to_id and o.id <> we.id
  );

update public.sets s set exercise_id = r.to_id from remap r where s.exercise_id = r.from_id;
update public.workout_exercises we set exercise_id = r.to_id from remap r
where we.exercise_id = r.from_id
  and not exists (
    select 1 from public.workout_exercises o
    where o.workout_id = we.workout_id and o.exercise_id = r.to_id and o.id <> we.id
  );
update public.template_exercises te set exercise_id = r.to_id from remap r where te.exercise_id = r.from_id;
update public.routine_exercises re set exercise_id = r.to_id from remap r where re.exercise_id = r.from_id;

delete from public.exercises e
where e.id in (select from_id from remap)
  and not exists (select 1 from public.sets s where s.exercise_id = e.id)
  and not exists (select 1 from public.workout_exercises we where we.exercise_id = e.id)
  and not exists (select 1 from public.template_exercises te where te.exercise_id = e.id)
  and not exists (select 1 from public.routine_exercises re where re.exercise_id = e.id);
`
    : ''
}

-- 2) Used orphans → private customs (Keenan Curl, etc.)
${
  keepCustom.length
    ? `update public.exercises
set is_custom = true,
    created_by = '${OWNER}'::uuid,
    name = coalesce(nullif(trim(name_en), ''), name),
    name_en = coalesce(nullif(trim(name_en), ''), name),
    name_pt = null
where id in (
${keepCustom.map((e) => `  '${e.id}'::uuid`).join(',\n')}
);`
    : ''
}

-- 3) Famous catalogue: English name, clear auto-PT for now
update public.exercises
set
  name = coalesce(nullif(trim(name_en), ''), name),
  name_en = coalesce(nullif(trim(name_en), ''), name),
  name_pt = null,
  is_custom = false,
  created_by = null,
  description = null
where id in (
${[...keepFamous].map((id) => `  '${id}'::uuid`).join(',\n')}
);

-- 4) Delete unused dump rows
delete from public.exercises
where id in (
${deleteCandidates.map((e) => `  '${e.id}'::uuid`).join(',\n')}
)
and not exists (select 1 from public.sets s where s.exercise_id = exercises.id)
and not exists (select 1 from public.workout_exercises we where we.exercise_id = exercises.id)
and not exists (select 1 from public.template_exercises te where te.exercise_id = exercises.id)
and not exists (select 1 from public.routine_exercises re where re.exercise_id = exercises.id);

commit;

select
  count(*) as total,
  count(*) filter (where not is_custom) as catalog,
  count(*) filter (where is_custom) as custom
from public.exercises;
`;

fs.writeFileSync(path.join(root, 'tmp', 'shrink-catalog-108.sql'), sql);
fs.writeFileSync(
  path.join(root, 'tmp', 'shrink-preview-108.json'),
  JSON.stringify(
    {
      remaps: remaps.length,
      keepCustom: keepCustom.length,
      keepFamous: keepFamous.size,
      deleteUnused: deleteCandidates.length,
      sampleRemaps: remaps.slice(0, 20),
      sampleCustom: keepCustom.slice(0, 30).map((e) => e.name),
    },
    null,
    2
  )
);

console.log({
  remaps: remaps.length,
  keepCustom: keepCustom.length,
  keepFamous: keepFamous.size,
  deleteUnused: deleteCandidates.length,
});
console.log('custom sample', keepCustom.slice(0, 15).map((e) => e.name));
