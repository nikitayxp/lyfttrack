/**
 * Build a gym/strength catalogue seed from yuhonas/free-exercise-db.
 * Output: supabase seed SQL + JSON preview. No hasaneyldrm / Gym media.
 *
 * Usage: node scripts/build-free-exercise-catalog.mjs
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'supabase', 'seeds');
const FED_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

const ALLOWED_CATEGORIES = new Set([
  'strength',
  'powerlifting',
  'olympic weightlifting',
  'strongman',
]);

/** @type {Record<string, 'barbell'|'dumbbell'|'machine'|'cable'|'bodyweight'|'kettlebell'|null>} */
const EQUIPMENT_MAP = {
  barbell: 'barbell',
  'e-z curl bar': 'barbell',
  dumbbell: 'dumbbell',
  kettlebells: 'kettlebell',
  kettlebell: 'kettlebell',
  machine: 'machine',
  cable: 'cable',
  'body only': 'bodyweight',
  bands: null, // skip — not in our filters
  'medicine ball': null,
  'exercise ball': null,
  'foam roll': null,
  other: null,
};

/** FED ids with equipment=other that are still normal gym moves. */
const EQUIPMENT_OVERRIDE_BY_ID = {
  Ab_Roller: 'bodyweight',
};

const EQUIPMENT_LABEL = {
  barbell: { en: 'Barbell', pt: 'Barra' },
  dumbbell: { en: 'Dumbbell', pt: 'Halter' },
  machine: { en: 'Machine', pt: 'Maquina' },
  cable: { en: 'Cable', pt: 'Polia' },
  bodyweight: { en: 'Bodyweight', pt: 'Peso corporal' },
  kettlebell: { en: 'Kettlebell', pt: 'Kettlebell' },
};

/** Strip these tokens from the base name (case-insensitive) so equipment lives in parentheses. */
const EQUIPMENT_NAME_TOKENS = [
  'barbell',
  'dumbbell',
  'dumbbells',
  'kettlebell',
  'kettlebells',
  'machine',
  'cable',
  'band',
  'bands',
  'ez-bar',
  'e-z curl bar',
  'ez bar',
  'body only',
  'bodyweight',
  'with bands',
];

const MUSCLE_MAP = {
  chest: 'chest',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  abdominals: 'core',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstrings',
  calves: 'calves',
  glutes: 'glutes',
  adductors: 'glutes',
  abductors: 'glutes',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  neck: 'shoulders',
};

const MUSCLE_LABEL = {
  chest: { en: 'Chest', pt: 'Peito' },
  back: { en: 'Back', pt: 'Costas' },
  shoulders: { en: 'Shoulders', pt: 'Ombros' },
  biceps: { en: 'Biceps', pt: 'Biceps' },
  triceps: { en: 'Triceps', pt: 'Triceps' },
  forearms: { en: 'Forearms', pt: 'Antebracos' },
  quadriceps: { en: 'Quadriceps', pt: 'Quadriceps' },
  hamstrings: { en: 'Hamstrings', pt: 'Posteriores' },
  glutes: { en: 'Glutes', pt: 'Gluteos' },
  calves: { en: 'Calves', pt: 'Gemeos' },
  core: { en: 'Core', pt: 'Core' },
};

/** Ordered phrase replacements for PT base names (longest first). */
const PT_PHRASES = [
  ['preacher hammer curl', 'Rosca Scott Martelo'],
  ['preacher curl', 'Rosca Scott'],
  ['hammer curl', 'Rosca Martelo'],
  ['concentration curl', 'Rosca Concentrada'],
  ['barbell curl', 'Rosca Direta'],
  ['alternate hammer curl', 'Rosca Martelo Alternada'],
  ['incline dumbbell curl', 'Rosca Inclinada'],
  ['incline hammer curl', 'Rosca Martelo Inclinada'],
  ['cable crossover', 'Crossover'],
  ['cable crunch', 'Abdominal na Polia'],
  ['face pull', 'Face Pull'],
  ['lat pulldown', 'Puxada Alta'],
  ['pull-up', 'Barra Fixa'],
  ['pull up', 'Barra Fixa'],
  ['chin-up', 'Barra Fixa Supinada'],
  ['chin up', 'Barra Fixa Supinada'],
  ['bench press', 'Supino'],
  ['incline bench press', 'Supino Inclinado'],
  ['decline bench press', 'Supino Declinado'],
  ['overhead press', 'Desenvolvimento'],
  ['military press', 'Desenvolvimento Militar'],
  ['shoulder press', 'Desenvolvimento'],
  ['lateral raise', 'Elevacao Lateral'],
  ['side lateral raise', 'Elevacao Lateral'],
  ['front raise', 'Elevacao Frontal'],
  ['rear delt raise', 'Elevacao Posterior'],
  ['bent over row', 'Remada Curvada'],
  ['seated row', 'Remada Sentada'],
  ['t-bar row', 'Remada T-Bar'],
  ['t bar row', 'Remada T-Bar'],
  ['deadlift', 'Peso Morto'],
  ['romanian deadlift', 'Peso Morto Romeno'],
  ['stiff leg deadlift', 'Peso Morto Pernas Rijas'],
  ['back squat', 'Agachamento'],
  ['front squat', 'Agachamento Frontal'],
  ['leg press', 'Leg Press'],
  ['leg curl', 'Mesa Flexora'],
  ['lying leg curl', 'Mesa Flexora'],
  ['seated leg curl', 'Mesa Flexora Sentada'],
  ['leg extension', 'Cadeira Extensora'],
  ['calf raise', 'Elevacao de Gemeos'],
  ['hip thrust', 'Elevacao Pelvica'],
  ['glute bridge', 'Ponte de Gluteo'],
  ['triceps pushdown', 'Pushdown de Triceps'],
  ['skull crusher', 'Triceps Testa'],
  ['close-grip bench press', 'Supino Pegada Fechada'],
  ['dip', 'Mergulho'],
  ['push-up', 'Flexao'],
  ['push up', 'Flexao'],
  ['crunch', 'Abdominal'],
  ['plank', 'Prancha'],
  ['ab wheel', 'Ab Wheel'],
  ['arnold press', 'Arnold Press'],
  ['fly', 'Crucifixo'],
  ['flyes', 'Crucifixo'],
  ['shrug', 'Encolhimento'],
  ['lunge', 'Afundo'],
  ['split squat', 'Agachamento Bulgaro'],
  ['good morning', 'Good Morning'],
  ['hyperextension', 'Hiperextensao'],
  ['pulldown', 'Puxada'],
  ['row', 'Remada'],
  ['curl', 'Rosca'],
  ['extension', 'Extensao'],
  ['press', 'Press'],
  ['raise', 'Elevacao'],
  ['squat', 'Agachamento'],
];

function uuidFromFedId(fedId) {
  // Deterministic UUIDv5-ish from SHA-1 (stable across runs).
  const hash = createHash('sha1').update(`lyfttrack:free-exercise-db:${fedId}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function esc(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function titleCase(words) {
  return words
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^[A-Z0-9]+$/.test(w) && w.length <= 3) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

function stripEquipmentFromName(name, equipmentKey) {
  let base = name.trim();
  // Remove parenthetical equipment already present
  base = base.replace(/\s*\([^)]*\)\s*$/g, '').trim();

  const patterns = [
    ...EQUIPMENT_NAME_TOKENS,
    ...(equipmentKey === 'dumbbell' ? ['db'] : []),
    ...(equipmentKey === 'barbell' ? ['bb'] : []),
  ];

  for (const token of patterns) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'ig');
    base = base.replace(re, ' ');
  }

  base = base.replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Drop leftover "with" at end
  base = base.replace(/\bwith\s*$/i, '').trim();
  // Normalize common plurals so Machine/Barbell variants share the same base stem
  base = base
    .replace(/\bCurls\b/g, 'Curl')
    .replace(/\bPresses\b/g, 'Press')
    .replace(/\bRaises\b/g, 'Raise')
    .replace(/\bFlyes\b/g, 'Fly')
    .replace(/\bFlies\b/g, 'Fly');
  if (!base) return name.trim();
  return titleCase(base);
}

function translateBaseToPt(enBase) {
  let lower = enBase
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\bcurls\b/g, 'curl')
    .replace(/\bpresses\b/g, 'press')
    .replace(/\braises\b/g, 'raise')
    .replace(/\bflies\b/g, 'fly')
    .replace(/\bflyes\b/g, 'fly');

  // Hand-tuned compounds first
  const exact = {
    'preacher curl': 'Rosca Scott',
    'preacher hammer curl': 'Rosca Scott Martelo',
    'one arm preacher curl': 'Rosca Scott Unilateral',
    'two arm preacher curl': 'Rosca Scott a Dois Bracos',
    'reverse preacher curl': 'Rosca Scott Invertida',
    'zottman preacher curl': 'Rosca Scott Zottman',
    'machine preacher curl': 'Rosca Scott',
    'cable preacher curl': 'Rosca Scott',
    'hammer curl': 'Rosca Martelo',
    'alternate hammer curl': 'Rosca Martelo Alternada',
    'incline hammer curl': 'Rosca Martelo Inclinada',
    'incline curl': 'Rosca Inclinada',
    'concentration curl': 'Rosca Concentrada',
    'barbell curl': 'Rosca Direta',
    'lying leg curl': 'Mesa Flexora',
    'seated leg curl': 'Mesa Flexora Sentada',
    'standing leg curl': 'Mesa Flexora em Pe',
    'leg curl': 'Mesa Flexora',
    'ab crunch': 'Abdominal',
    'ab roller': 'Ab Wheel',
    'ab rollout': 'Ab Wheel',
    'ab rollout on knees': 'Ab Wheel de Joelhos',
  };
  if (exact[lower]) return exact[lower];

  const sorted = [...PT_PHRASES].sort((a, b) => b[0].length - a[0].length);
  let out = lower;
  let hit = false;
  for (const [en, pt] of sorted) {
    if (out.includes(en)) {
      out = out.replace(en, ` ${pt.toLowerCase()} `);
      hit = true;
      break;
    }
  }
  if (!hit) return enBase;
  out = out.replace(/\s+/g, ' ').trim();
  return titleCase(out);
}

function withEquipmentParen(base, equipmentKey, lang) {
  const label = EQUIPMENT_LABEL[equipmentKey][lang];
  // Avoid "Foo (Bar) (Bar)"
  const cleaned = base.replace(new RegExp(`\\s*\\(${label}\\)\\s*$`, 'i'), '').trim();
  return `${cleaned} (${label})`;
}

function mapMuscle(primaryMuscles) {
  const primary = (primaryMuscles && primaryMuscles[0]) || null;
  if (!primary) return null;
  return MUSCLE_MAP[primary] || null;
}

function shouldKeep(entry) {
  const category = (entry.category || '').toLowerCase();
  if (!ALLOWED_CATEGORIES.has(category)) return false;
  if (!entry.id || !entry.name) return false;
  if (!Array.isArray(entry.images) || entry.images.length === 0) return false;

  if (EQUIPMENT_OVERRIDE_BY_ID[entry.id]) return true;

  const rawEq = (entry.equipment || '').toLowerCase();
  if (!rawEq) return false;
  if (!(rawEq in EQUIPMENT_MAP)) return false;
  if (EQUIPMENT_MAP[rawEq] == null) return false;
  return true;
}

async function loadFed() {
  const cachePath = join(ROOT, 'tmp', 'free-exercise-db-exercises.json');
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, 'utf8'));
  }
  const res = await fetch(FED_URL);
  if (!res.ok) throw new Error(`fetch FED failed: ${res.status}`);
  const data = await res.json();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data));
  return data;
}

function buildRows(fed) {
  const rows = [];
  for (const entry of fed) {
    if (!shouldKeep(entry)) continue;
    const equipment =
      EQUIPMENT_OVERRIDE_BY_ID[entry.id] ||
      EQUIPMENT_MAP[(entry.equipment || '').toLowerCase()];
    if (!equipment) continue;
    const muscle = mapMuscle(entry.primaryMuscles);
    if (!muscle) continue;

    const baseEn = stripEquipmentFromName(entry.name, equipment);
    const basePt = translateBaseToPt(baseEn);
    const nameEn = withEquipmentParen(baseEn, equipment, 'en');
    const namePt = withEquipmentParen(basePt, equipment, 'pt');
    const labels = MUSCLE_LABEL[muscle];
    const id = uuidFromFedId(entry.id);
    const image_url = `${IMAGE_BASE}/${entry.id}/0.jpg`;

    rows.push({
      id,
      fed_id: entry.id,
      name: nameEn,
      name_en: nameEn,
      name_pt: namePt,
      muscle_group: muscle,
      muscle_en: labels.en,
      muscle_pt: labels.pt,
      equipment,
      is_custom: false,
      created_by: null,
      image_url,
      description: null,
    });
  }

  // Stable sort
  rows.sort((a, b) => a.name_en.localeCompare(b.name_en));
  return rows;
}

function toSql(rows) {
  const lines = [];
  lines.push('-- Auto-generated from yuhonas/free-exercise-db (gym/strength only) — issue #110');
  lines.push('-- DO NOT use hasaneyldrm / Gym visual media.');
  lines.push('begin;');
  lines.push('alter table public.exercises add column if not exists name_en text;');
  lines.push('alter table public.exercises add column if not exists muscle_en text;');
  lines.push('alter table public.exercises add column if not exists muscle_pt text;');
  lines.push('alter table public.exercises add column if not exists description text;');
  lines.push('');
  lines.push(
    'insert into public.exercises (id, name, name_en, name_pt, muscle_group, muscle_en, muscle_pt, equipment, is_custom, created_by, image_url, description) values'
  );

  const values = rows.map(
    (r) =>
      `  (${esc(r.id)}::uuid, ${esc(r.name)}, ${esc(r.name_en)}, ${esc(r.name_pt)}, ${esc(r.muscle_group)}, ${esc(r.muscle_en)}, ${esc(r.muscle_pt)}, ${esc(r.equipment)}, false, null, ${esc(r.image_url)}, null)`
  );
  lines.push(values.join(',\n'));
  lines.push(`on conflict (id) do update set
  name = excluded.name,
  name_en = excluded.name_en,
  name_pt = excluded.name_pt,
  muscle_group = excluded.muscle_group,
  muscle_en = excluded.muscle_en,
  muscle_pt = excluded.muscle_pt,
  equipment = excluded.equipment,
  is_custom = false,
  created_by = null,
  image_url = excluded.image_url;`);
  lines.push('');

  // Remap known legacy seed ids (still referenced by leftover test workouts) → FED rows
  const legacyRemap = [
    // Bench Press → Barbell Bench Press (Medium Grip) if present, else any bench press barbell
    ['3437f3ba-ff10-4655-b747-3206e67a07c6', 'Barbell_Bench_Press_-_Medium_Grip'],
    ['403f0bad-9eaf-4a08-add0-0a3b82aacfe3', 'Barbell_Curl'],
    ['3f2857a0-1651-498c-a710-241f7fc789e3', 'Ab_Roller'],
    ['5c202939-52b6-498c-8552-37e1f265d3af', 'Kettlebell_Arnold_Press'],
  ];
  const byFed = new Map(rows.map((r) => [r.fed_id, r]));
  lines.push('-- Remap legacy referenced seed → FED catalogue ids');
  for (const [fromId, fedId] of legacyRemap) {
    const to = byFed.get(fedId);
    if (!to) continue;
    lines.push(`update public.sets set exercise_id = ${esc(to.id)}::uuid where exercise_id = ${esc(fromId)}::uuid;`);
    lines.push(`update public.workout_exercises set exercise_id = ${esc(to.id)}::uuid where exercise_id = ${esc(fromId)}::uuid
  and not exists (
    select 1 from public.workout_exercises o
    where o.workout_id = workout_exercises.workout_id and o.exercise_id = ${esc(to.id)}::uuid and o.id <> workout_exercises.id
  );`);
    lines.push(`delete from public.workout_exercises where exercise_id = ${esc(fromId)}::uuid;`);
    lines.push(`update public.template_exercises set exercise_id = ${esc(to.id)}::uuid where exercise_id = ${esc(fromId)}::uuid;`);
    lines.push(`update public.routine_exercises set exercise_id = ${esc(to.id)}::uuid where exercise_id = ${esc(fromId)}::uuid;`);
  }
  lines.push('');

  const keep = rows.map((r) => `${esc(r.id)}::uuid`).join(', ');
  lines.push(`-- Drop old catalogue rows that are not in the new seed and not referenced`);
  lines.push(`delete from public.exercises e
where e.is_custom = false
  and e.id not in (${keep})
  and not exists (select 1 from public.sets s where s.exercise_id = e.id)
  and not exists (select 1 from public.workout_exercises we where we.exercise_id = e.id)
  and not exists (select 1 from public.template_exercises te where te.exercise_id = e.id)
  and not exists (select 1 from public.routine_exercises re where re.exercise_id = e.id);`);
  lines.push('commit;');
  lines.push('');
  lines.push(`-- expect ~${rows.length} catalogue rows`);
  return lines.join('\n');
}

function selfCheck(rows) {
  const by = (pred) => rows.filter(pred);
  const scott = by((r) => /scott|preacher/i.test(r.name_en) || /scott|preacher/i.test(r.fed_id));
  const asserts = [];
  const eq = new Set(scott.map((r) => r.equipment));
  asserts.push(['scott variants >= 2', scott.length >= 2]);
  asserts.push(['scott has barbell or machine or dumbbell', eq.has('barbell') || eq.has('machine') || eq.has('dumbbell')]);
  asserts.push(['all have image_url', rows.every((r) => r.image_url && r.image_url.includes('/0.jpg'))]);
  asserts.push(['all have paren equipment EN', rows.every((r) => /\([^)]+\)$/.test(r.name_en))]);
  asserts.push(['all have paren equipment PT', rows.every((r) => /\([^)]+\)$/.test(r.name_pt))]);
  asserts.push(['no mixed lang in EN names (no Maquina/Halter/Barra)', rows.every((r) => !/\b(Maquina|Halter|Barra|Polia)\b/.test(r.name_en))]);
  const failed = asserts.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error('SELF-CHECK FAILED', failed.map(([m]) => m));
    console.error('scott sample', scott.slice(0, 8).map((r) => r.name_en));
    process.exit(1);
  }
  console.log('self-check ok');
  console.log('scott variants:', scott.map((r) => `${r.name_en} | ${r.name_pt}`).slice(0, 12));
}

async function main() {
  const fed = await loadFed();
  const rows = buildRows(fed);
  selfCheck(rows);

  mkdirSync(OUT_DIR, { recursive: true });
  const sqlPath = join(OUT_DIR, 'free_exercise_db_catalog_110.sql');
  writeFileSync(sqlPath, toSql(rows), 'utf8');
  const previewPath = join(OUT_DIR, 'free_exercise_db_catalog_110.preview.json');
  writeFileSync(
    previewPath,
    JSON.stringify(
      {
        source: 'yuhonas/free-exercise-db',
        filter: 'strength|powerlifting|olympic weightlifting|strongman + mapped equipment',
        count: rows.length,
        scottSample: rows
          .filter((r) => /preacher|scott/i.test(r.name_en) || /scott/i.test(r.name_pt))
          .map((r) => ({ en: r.name_en, pt: r.name_pt, equipment: r.equipment })),
        byEquipment: rows.reduce((acc, r) => {
          acc[r.equipment] = (acc[r.equipment] || 0) + 1;
          return acc;
        }, {}),
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`wrote ${rows.length} exercises → ${sqlPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
