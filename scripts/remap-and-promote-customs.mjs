/**
 * Remap Hevy customs → catalogue with explicit aliases + token fallback.
 * Then promote remaining unmatched customs to shared catalogue (PT names stay).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');

function loadExercises() {
  const buf = execSync('npx supabase db query --linked -o json -f tmp/export-exercises.sql', {
    cwd: root,
    maxBuffer: 50 * 1024 * 1024,
  });
  const t = buf.toString('utf8');
  const raw = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  fs.writeFileSync(path.join(root, 'tmp', 'all-exercises.json'), JSON.stringify(raw.rows));
  return raw.rows;
}

const HEVY_TO_CATALOG_RAW = {
  'agachamento (barra)': 'Back Squat',
  'agachamento hack (maquina)': 'Hack Squat',
  'supino (barra)': 'Barbell Bench Press',
  'supino (halter)': 'Dumbbell Bench Press',
  'supino inclinado (halter)': 'Incline Dumbbell Bench Press',
  'supino inclinado na maquina': 'Machine Chest Press',
  'supino sentado (maquina)': 'Machine Chest Press',
  'supino no smith (maquina)': 'Smith Machine Bench Press',
  'supino inclinado no smith (maquina)': 'Smith Machine Incline Bench Press',
  'supino declinado (maquina)': 'Decline Bench Press',
  'barra fixa': 'Pull Up',
  'barra fixa (com peso)': 'Pull Up',
  'puxada alta (maquina)': 'Lat Pulldown',
  'puxada alta na polia (maquina)': 'Lat Pulldown',
  'puxada alta - pegada triangulo': 'Lat Pulldown',
  'remada (barra)': 'Barbell Bent Over Row',
  'remadas dobradas (barra)': 'Barbell Bent Over Row',
  'remo sentado (maquina)': 'Seated Cable Row',
  'remada sentada com pegada em v (cabo)': 'Seated Cable Row',
  'remada unilateral na polia': 'One Arm Dumbbell Row',
  'elevacao lateral (halter)': 'Dumbbell Lateral Raise',
  'elevacao lateral (cabo)': 'Cable Lateral Raise',
  'elevacao frontal (halter)': 'Dumbbell Front Raise',
  'elevacao frontal (cabo)': 'Cable Front Raise',
  'elevacao pelvica (barra)': 'Hip Thrust',
  'cadeira extensora (maquina)': 'Leg Extension',
  'cadeira flexora (maquina)': 'Leg Curl',
  'mesa flexora (maquina)': 'Leg Curl',
  'leg press 45 (maquina)': 'Leg Press',
  'leg press 45o (maquina)': 'Leg Press',
  'leg press horizontal (maquina)': 'Leg Press',
  'press de ombros (sentada) (halter)': 'Seated Dumbbell Shoulder Press',
  'press de ombros (sentada) (barra)': 'Barbell Overhead Press',
  'desenvolvimento de ombros (maquina de placas)': 'Machine Shoulder Press',
  'prensa de ombros (sentada) (maquina)': 'Machine Shoulder Press',
  'rosca direta (halter)': 'Dumbbell Curl',
  'rosca direta na polia': 'Cable Curl',
  'rosca inclinada (halter)': 'Dumbbell Curl',
  'rosca scott (halter)': 'Dumbbell Preacher Curl',
  'rosca scott (barra)': 'Barbell Preacher Curl',
  'rosca scott (maquina)': 'Preacher Curl',
  'rosca martelo (halter)': 'Dumbbell Hammer Curl',
  'triceps na polia': 'Triceps Pushdown',
  'triceps na polia com corda': 'Rope Triceps Pushdown',
  'triceps testa (barra)': 'Skull Crusher',
  'triceps na paralela (com peso)': 'Chest Dip',
  'crucifixo na polia (maquina)': 'Cable Chest Fly',
  'crucifixo inclinado': 'Incline Dumbbell Fly',
  'abdominal declinado (com peso)': 'Decline Crunch',
  'abdominal na maquina': 'Cable Crunch',
  'elevacao de panturrilha em pe (maquina)': 'Standing Calf Raise',
  'elevacao de panturrilha sentado (maquina)': 'Seated Calf Raise',
  'cadeira adutora (maquina)': 'Leverage Machine Hip Adduction',
  'peso morto com pernas esticadas': 'Romanian Deadlift',
  'extensao lombar maquina': 'Hyperextension',
  'hiperextensao reversa': 'Hyperextension',
  'aberturas invertidas de ombro posterior (na maquina)': 'Reverse Pec Deck',
  'crucifixo baixo na polia (maquina)': 'Cable Chest Fly',
  'puxada com o braco reto (corda)': 'Straight Arm Pulldown',
};

const HEVY_TO_CATALOG = Object.fromEntries(
  Object.entries(HEVY_TO_CATALOG_RAW).map(([k, v]) => [normalizeKey(k), v])
);

function normalizeKey(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/º/g, 'o')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const exercises = loadExercises();
const catalog = exercises.filter((e) => !e.is_custom);
const customs = exercises.filter((e) => e.is_custom);

const byName = new Map();
for (const item of catalog) {
  for (const n of [item.name, item.name_en, item.name_pt]) {
    if (!n) continue;
    byName.set(normalizeKey(n), item);
  }
}

function findCatalogByPreferredName(preferred) {
  return byName.get(normalizeKey(preferred)) ?? null;
}

// Prefer exact catalogue name hits for aliases; skip ambiguous.
const remaps = [];
const unmatched = [];

for (const custom of customs) {
  const key = normalizeKey(custom.name);
  const preferred = HEVY_TO_CATALOG[key];
  let target = preferred ? findCatalogByPreferredName(preferred) : null;

  // If preferred missing, try dropping parenthetical equipment and matching name_pt-ish.
  if (!target) {
    target = byName.get(key) ?? null;
  }

  if (target) {
    remaps.push({
      custom_id: custom.id,
      custom_name: custom.name,
      catalog_id: target.id,
      catalog_name: target.name,
      via: preferred ? 'hevy-map' : 'exact',
    });
  } else {
    unmatched.push(custom);
  }
}

// Fix bad row remaps: never map plain Barra Fixa onto Weighted*
const cleaned = remaps.filter((r) => {
  if (/^barra fixa$/i.test(normalizeKey(r.custom_name)) && /weighted/i.test(r.catalog_name)) {
    return false;
  }
  return true;
});

const promoteIds = unmatched.map((c) => c.id);

fs.writeFileSync(
  path.join(root, 'tmp', 'remap-preview.json'),
  JSON.stringify(
    {
      remapped: cleaned.length,
      promote: promoteIds.length,
      remaps: cleaned,
      promoteNames: unmatched.map((c) => c.name),
    },
    null,
    2
  )
);

const remapValues = cleaned.map((r) => `  ('${r.custom_id}'::uuid, '${r.catalog_id}'::uuid)`).join(',\n');
const promoteValues = promoteIds.map((id) => `  '${id}'::uuid`).join(',\n');

const sql = `-- #104 remap Hevy customs + promote remaining PT names into catalogue
begin;

${
  cleaned.length
    ? `create temporary table custom_remap(custom_id uuid, catalog_id uuid) on commit drop;
insert into custom_remap(custom_id, catalog_id) values
${remapValues};

delete from public.workout_exercises we
using custom_remap r
where we.exercise_id = r.custom_id
  and exists (
    select 1 from public.workout_exercises other
    where other.workout_id = we.workout_id
      and other.exercise_id = r.catalog_id
      and other.id <> we.id
  );

update public.sets s set exercise_id = r.catalog_id from custom_remap r where s.exercise_id = r.custom_id;
update public.workout_exercises we set exercise_id = r.catalog_id from custom_remap r
where we.exercise_id = r.custom_id
  and not exists (
    select 1 from public.workout_exercises other
    where other.workout_id = we.workout_id and other.exercise_id = r.catalog_id and other.id <> we.id
  );
update public.template_exercises te set exercise_id = r.catalog_id from custom_remap r where te.exercise_id = r.custom_id;
update public.routine_exercises re set exercise_id = r.catalog_id from custom_remap r where re.exercise_id = r.custom_id;

delete from public.exercises e
where e.id in (select custom_id from custom_remap)
  and not exists (select 1 from public.sets s where s.exercise_id = e.id)
  and not exists (select 1 from public.workout_exercises we where we.exercise_id = e.id)
  and not exists (select 1 from public.template_exercises te where te.exercise_id = e.id)
  and not exists (select 1 from public.routine_exercises re where re.exercise_id = e.id);
`
    : '-- no remaps\n'
}

${
  promoteIds.length
    ? `update public.exercises
set is_custom = false,
    created_by = null,
    name_en = coalesce(nullif(name_en, ''), name),
    name_pt = coalesce(nullif(name_pt, ''), name)
where id in (
${promoteValues}
);`
    : '-- nothing to promote\n'
}

commit;

select
  (select count(*) from public.exercises where not is_custom) as catalog,
  (select count(*) from public.exercises where is_custom) as custom_remaining;
`;

fs.writeFileSync(path.join(root, 'tmp', 'remap-and-promote.sql'), sql);
console.log(`Remaps: ${cleaned.length}; promote to catalogue: ${promoteIds.length}`);
console.log(
  'Sample remaps:',
  cleaned.slice(0, 20).map((r) => `${r.custom_name} → ${r.catalog_name}`)
);
console.log('Promote sample:', unmatched.slice(0, 15).map((c) => c.name));
