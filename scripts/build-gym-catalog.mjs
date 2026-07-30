/**
 * Build a gym-only exercise catalogue from hasaneyldrm/exercises-dataset
 * (MIT data: names / muscles / equipment). Media (GIFs/images) is NOT used.
 *
 * Usage: node scripts/build-gym-catalog.mjs
 * Reads:  tmp/exercises-dataset.json
 * Writes: tmp/gym-catalog-seed.sql
 *         tmp/gym-catalog-preview.json
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'tmp', 'exercises-dataset.json');
const sqlPath = path.join(root, 'tmp', 'gym-catalog-seed.sql');
const previewPath = path.join(root, 'tmp', 'gym-catalog-preview.json');

const CARDIO_EQUIPMENT = new Set([
  'stationary bike',
  'elliptical machine',
  'skierg machine',
  'stepmill machine',
  'upper body ergometer',
]);

const GYM_EQUIPMENT = new Set([
  'barbell',
  'dumbbell',
  'cable',
  'leverage machine',
  'smith machine',
  'ez barbell',
  'kettlebell',
  'olympic barbell',
  'trap bar',
  'sled machine',
  'assisted',
  'weighted',
]);

const BODYWEIGHT_KEEP =
  /pull.?up|chin.?up|dip|push.?up|plank|sit.?up|crunch|hanging|muscle.?up|pike|handstand|hyperextension|back extension|glute bridge|hip thrust|nordic|pistol|squat|lunge|inverted row|ab wheel|abs wheel|leg raise|knee raise|russian twist|dead bug|hollow|v.?up|toes to bar|dragon flag|calf raise|shrug|pull.?in|windmill|side plank|bicycle crunch|flutter kick|scissors|hanging leg|captain.?s chair/i;

const NAME_BAN =
  /burpee|jumping jack|mountain climber|jump rope|skipping|sprint|treadmill|bike|elliptical|battle rope|shadow boxing|\brun\b|running|star jump|high knee|butt kick|box jump|depth jump|stretch|yoga|foam roll|\broller\b|\bwalk\b|walking |farmer|tire |climber|\bcrawl\b|jack.?knife|ski erg|cross trainer|air bike|bear crawl|astride jump|back and forth step/i;

const EQUIPMENT_MAP = {
  barbell: 'barbell',
  'olympic barbell': 'barbell',
  'ez barbell': 'barbell',
  'trap bar': 'barbell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  'leverage machine': 'machine',
  'smith machine': 'machine',
  'sled machine': 'machine',
  assisted: 'machine',
  kettlebell: 'kettlebell',
  weighted: 'bodyweight',
  'body weight': 'bodyweight',
};

const TARGET_TO_MUSCLE = {
  abs: 'core',
  abdominals: 'core',
  obliques: 'core',
  spine: 'core',
  pectorals: 'chest',
  chest: 'chest',
  lats: 'back',
  traps: 'back',
  'upper back': 'back',
  'lower back': 'back',
  rhomboids: 'back',
  delts: 'shoulders',
  deltoids: 'shoulders',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  quads: 'quadriceps',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  adductors: 'quadriceps',
  abductors: 'glutes',
  serratus: 'chest',
  levator: 'shoulders',
};

const MUSCLE_LABELS = {
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

/** Rough EN→PT gym phrasing so Hevy PT exports can alias-match. */
const PT_PHRASES = [
  [/weighted pull-?ups?/gi, 'Barra Fixa com Peso'],
  [/assisted pull-?ups?/gi, 'Barra Fixa Assistida'],
  [/archer pull-?ups?/gi, 'Barra Fixa Archer'],
  [/pull-?ups?/gi, 'Barra Fixa'],
  [/chin-?ups?/gi, 'Barra Fixa Supinada'],
  [/barbell bench press/gi, 'Supino Reto com Barra'],
  [/incline barbell bench press/gi, 'Supino Inclinado com Barra'],
  [/decline barbell bench press/gi, 'Supino Declinado com Barra'],
  [/dumbbell bench press/gi, 'Supino Reto com Halteres'],
  [/incline dumbbell bench press/gi, 'Supino Inclinado com Halteres'],
  [/decline dumbbell bench press/gi, 'Supino Declinado com Halteres'],
  [/bench press/gi, 'Supino'],
  [/deadlift/gi, 'Levantamento Terra'],
  [/romanian deadlift/gi, 'Levantamento Terra Romeno'],
  [/back squat/gi, 'Agachamento Livre'],
  [/front squat/gi, 'Agachamento Frontal'],
  [/hack squat/gi, 'Agachamento Hack'],
  [/leg press/gi, 'Leg Press'],
  [/leg extension/gi, 'Cadeira Extensora'],
  [/lying leg curl/gi, 'Mesa Flexora'],
  [/seated leg curl/gi, 'Cadeira Flexora'],
  [/leg curl/gi, 'Flexora'],
  [/lat pulldown/gi, 'Puxada Frontal'],
  [/pull.?up/gi, 'Barra Fixa'],
  [/chin.?up/gi, 'Barra Fixa Supinada'],
  [/cable seated row/gi, 'Remada Baixa na Polia'],
  [/seated row/gi, 'Remada Sentada'],
  [/bent over row/gi, 'Remada Curvada'],
  [/t.?bar row/gi, 'Remada T-Bar'],
  [/shoulder press/gi, 'Desenvolvimento de Ombros'],
  [/military press/gi, 'Desenvolvimento Militar'],
  [/overhead press/gi, 'Desenvolvimento'],
  [/lateral raise/gi, 'Elevacao Lateral'],
  [/front raise/gi, 'Elevacao Frontal'],
  [/rear delt/gi, 'Deltoide Posterior'],
  [/face pull/gi, 'Face Pull'],
  [/barbell curl/gi, 'Rosca Direta com Barra'],
  [/dumbbell curl/gi, 'Rosca com Halteres'],
  [/hammer curl/gi, 'Rosca Martelo'],
  [/preacher curl/gi, 'Rosca Scott'],
  [/concentration curl/gi, 'Rosca Concentrada'],
  [/triceps pushdown/gi, 'Triceps Pulley'],
  [/pushdown/gi, 'Pulley'],
  [/skull crusher/gi, 'Triceps Testa'],
  [/overhead.*triceps/gi, 'Extensao de Triceps Acima da Cabeca'],
  [/tricep/gi, 'Triceps'],
  [/bicep/gi, 'Biceps'],
  [/calf raise/gi, 'Elevacao de Gemeos'],
  [/hip thrust/gi, 'Elevacao Pelvica'],
  [/glute bridge/gi, 'Ponte de Gluteo'],
  [/cable fly/gi, 'Crucifixo na Polia'],
  [/dumbbell fly/gi, 'Crucifixo com Halteres'],
  [/pec deck/gi, 'Crucifixo na Maquina'],
  [/chest fly/gi, 'Crucifixo'],
  [/cable crossover/gi, 'Crossover na Polia'],
  [/push.?up/gi, 'Flexao'],
  [/dip/gi, 'Mergulho'],
  [/plank/gi, 'Prancha'],
  [/crunch/gi, 'Abdominal'],
  [/sit.?up/gi, 'Abdominal'],
  [/lunge/gi, 'Avanco'],
  [/bulgarian split squat/gi, 'Agachamento Bulgaro'],
  [/goblet squat/gi, 'Agachamento Goblet'],
  [/shrug/gi, 'Encolhimento'],
  [/hyperextension/gi, 'Hiperextensao'],
  [/back extension/gi, 'Extensao Lombar'],
];

const PT_WORDS = [
  [/\bbarbell\b/gi, 'Barra'],
  [/\bdumbbell\b/gi, 'Halter'],
  [/\bcable\b/gi, 'Polia'],
  [/\bmachine\b/gi, 'Maquina'],
  [/\bsmith\b/gi, 'Smith'],
  [/\bkettlebell\b/gi, 'Kettlebell'],
  [/\bincline\b/gi, 'Inclinado'],
  [/\bdecline\b/gi, 'Declinado'],
  [/\bseated\b/gi, 'Sentado'],
  [/\bstanding\b/gi, 'Em Pe'],
  [/\blying\b/gi, 'Deitado'],
  [/\bclose.?grip\b/gi, 'Pegada Fechada'],
  [/\bwide.?grip\b/gi, 'Pegada Aberta'],
  [/\bone.?arm\b/gi, 'Unilateral'],
  [/\bsingle.?arm\b/gi, 'Unilateral'],
  [/\bsingle.?leg\b/gi, 'Unilateral'],
  [/\balternating\b/gi, 'Alternado'],
  [/\bassisted\b/gi, 'Assistido'],
  [/\bweighted\b/gi, 'Com Peso'],
  [/\bleverage\b/gi, ''],
  [/\bez\b/gi, 'EZ'],
];

function titleCase(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPtName(englishName) {
  let out = englishName.replace(/\s*\((male|female)\)\s*/gi, ' ').trim();
  for (const [re, rep] of PT_PHRASES) {
    if (re.test(out)) {
      out = out.replace(re, rep);
      break;
    }
  }
  for (const [re, rep] of PT_WORDS) {
    out = out.replace(re, rep);
  }
  return titleCase(out.replace(/\s+/g, ' ').trim()) || englishName;
}

function normalizeKey(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function baseName(name) {
  return normalizeKey(name.replace(/\s*\((male|female)\)\s*/gi, ' '));
}

function mapMuscle(entry) {
  const candidates = [entry.target, entry.muscle_group, ...(entry.secondary_muscles ?? [])];
  for (const raw of candidates) {
    if (!raw) continue;
    const key = normalizeKey(raw).replace(/\s+/g, ' ');
    const compact = key.replace(/\s+/g, '_');
    if (TARGET_TO_MUSCLE[key]) return TARGET_TO_MUSCLE[key];
    if (TARGET_TO_MUSCLE[compact]) return TARGET_TO_MUSCLE[compact];
    for (const [alias, muscle] of Object.entries(TARGET_TO_MUSCLE)) {
      if (key.includes(alias) || alias.includes(key)) return muscle;
    }
  }
  // body_part fallback
  const bp = entry.body_part;
  if (bp === 'chest') return 'chest';
  if (bp === 'back') return 'back';
  if (bp === 'shoulders') return 'shoulders';
  if (bp === 'upper arms') {
    const n = entry.name.toLowerCase();
    if (n.includes('tricep')) return 'triceps';
    if (n.includes('bicep') || n.includes('curl')) return 'biceps';
    return 'biceps';
  }
  if (bp === 'lower arms') return 'forearms';
  if (bp === 'upper legs') {
    const n = entry.name.toLowerCase();
    if (n.includes('hamstring') || n.includes('curl') || n.includes('romanian') || n.includes('stiff')) {
      return 'hamstrings';
    }
    if (n.includes('glute') || n.includes('hip thrust') || n.includes('kickback')) return 'glutes';
    return 'quadriceps';
  }
  if (bp === 'lower legs') return 'calves';
  if (bp === 'waist' || bp === 'neck') return 'core';
  return 'core';
}

function keep(entry) {
  if (entry.body_part === 'cardio') return false;
  if (CARDIO_EQUIPMENT.has(entry.equipment)) return false;
  if (NAME_BAN.test(entry.name)) return false;
  if (entry.equipment === 'body weight') return BODYWEIGHT_KEEP.test(entry.name);
  if (entry.equipment === 'band' || entry.equipment === 'resistance band' || entry.equipment === 'medicine ball') {
    return false;
  }
  if (entry.equipment === 'stability ball' || entry.equipment === 'bosu ball' || entry.equipment === 'roller') {
    return false;
  }
  if (entry.equipment === 'rope' || entry.equipment === 'hammer' || entry.equipment === 'wheel roller') {
    return false;
  }
  return GYM_EQUIPMENT.has(entry.equipment);
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const seen = new Set();
const rows = [];

for (const entry of source) {
  if (!keep(entry)) continue;
  const key = baseName(entry.name);
  if (seen.has(key)) continue;
  seen.add(key);

  const muscle = mapMuscle(entry);
  const equipment = EQUIPMENT_MAP[entry.equipment] ?? null;
  const nameEn = titleCase(entry.name.replace(/\s*\((male|female)\)\s*/gi, ' ').trim());
  const namePt = toPtName(entry.name);
  const labels = MUSCLE_LABELS[muscle];

  rows.push({
    name: nameEn,
    name_en: nameEn,
    name_pt: namePt,
    muscle_group: muscle,
    muscle_en: labels.en,
    muscle_pt: labels.pt,
    equipment,
    source_id: entry.id,
  });
}

rows.sort((a, b) => a.name.localeCompare(b.name));

const values = rows
  .map(
    (r) =>
      `  (${sqlString(r.name)}, ${sqlString(r.name_en)}, ${sqlString(r.name_pt)}, ${sqlString(r.muscle_group)}, ${sqlString(r.muscle_en)}, ${sqlString(r.muscle_pt)}, ${r.equipment ? sqlString(r.equipment) : 'null'})`
  )
  .join(',\n');

const sql = `-- Auto-generated gym catalogue seed (#104)
-- Source: hasaneyldrm/exercises-dataset (MIT names/metadata only — NO Gym visual media)
-- Filter: weightlifting / gym machines; no cardio, no CrossFit-style cardio toys
-- Generated: ${new Date().toISOString()}
-- Count: ${rows.length}

begin;

with seed(name, name_en, name_pt, muscle_group, muscle_en, muscle_pt, equipment) as (
  values
${values}
),
normalized as (
  select
    s.*,
    lower(trim(regexp_replace(coalesce(s.name_en, s.name), '[^a-zA-Z0-9]+', ' ', 'g'))) as key_en,
    lower(trim(regexp_replace(coalesce(s.name_pt, s.name), '[^a-zA-Z0-9]+', ' ', 'g'))) as key_pt
  from seed s
),
existing as (
  select
    id,
    lower(trim(regexp_replace(coalesce(name_en, name), '[^a-zA-Z0-9]+', ' ', 'g'))) as key_en,
    lower(trim(regexp_replace(coalesce(name_pt, name), '[^a-zA-Z0-9]+', ' ', 'g'))) as key_pt
  from public.exercises
  where is_custom = false
)
insert into public.exercises (
  name, name_en, name_pt, muscle_group, muscle_en, muscle_pt, equipment, is_custom, created_by, image_url
)
select
  n.name,
  n.name_en,
  n.name_pt,
  n.muscle_group,
  n.muscle_en,
  n.muscle_pt,
  n.equipment,
  false,
  null,
  null
from normalized n
where not exists (
  select 1 from existing e
  where e.key_en = n.key_en
     or (n.key_pt <> '' and e.key_pt = n.key_pt)
     or e.key_en = n.key_pt
     or e.key_pt = n.key_en
);

commit;
`;

fs.writeFileSync(sqlPath, sql);
fs.writeFileSync(previewPath, JSON.stringify({ count: rows.length, sample: rows.slice(0, 30), byEquipment: rows.reduce((acc, r) => {
  acc[r.equipment ?? 'null'] = (acc[r.equipment ?? 'null'] ?? 0) + 1;
  return acc;
}, {}) }, null, 2));

console.log(`Wrote ${rows.length} exercises → ${sqlPath}`);
console.log(`Preview → ${previewPath}`);
