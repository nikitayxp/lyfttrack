/**
 * Promote approved Hevy CSV candidates into the public catalogue (#112).
 * Skips personal customs. Reads tmp/hevy-catalog-review.json.
 *
 * Usage:
 *   node scripts/promote-hevy-candidates.mjs
 *   node scripts/promote-hevy-candidates.mjs --apply
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REVIEW = join(ROOT, 'tmp', 'hevy-catalog-review.json');
const OUT_SQL = join(ROOT, 'supabase', 'seeds', 'hevy_promote_112.sql');
const OUT_JSON = join(ROOT, 'supabase', 'seeds', 'hevy_promote_112.preview.json');
const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

/** Personal nicknames / vague one-off customs — do not promote. */
const PERSONAL = new Set(
  [
    'Keenan Curl',
    'Kelso',
    'Balesian Curl',
    'Aquele Extensao Tricep Cabeca Meio',
    'Rosca Unilateral Do Samsulek Na Polia',
    'Elevação Frontal Da Bolacha',
    'Unilateral Extension',
    'Extensão Unilateral',
    'Bicep Sentado Alterando',
  ].map(normalizeTitle)
);

const MUSCLE_LABEL = {
  chest: { en: 'Chest', pt: 'Peito' },
  back: { en: 'Back', pt: 'Costas' },
  shoulders: { en: 'Shoulders', pt: 'Ombros' },
  biceps: { en: 'Biceps', pt: 'Biceps' },
  triceps: { en: 'Triceps', pt: 'Triceps' },
  forearms: { en: 'Forearms', pt: 'Antebracos' },
  core: { en: 'Core', pt: 'Core' },
  quadriceps: { en: 'Quadriceps', pt: 'Quadriceps' },
  hamstrings: { en: 'Hamstrings', pt: 'Posteriores' },
  calves: { en: 'Calves', pt: 'Panturrilhas' },
  glutes: { en: 'Glutes', pt: 'Gluteos' },
  other: { en: 'Other', pt: 'Outro' },
};

/** Best-effort FED image ids for common Hevy gaps. */
const IMAGE_BY_NORM = {
  'extensao de triceps unilateral cabo': 'Cable_One_Arm_Tricep_Extension',
  'remada na barra t': 'T-Bar_Row_with_Handle',
  'rosca scott halter': 'Two-Arm_Dumbbell_Preacher_Curl',
  'cadeira adutora maquina': 'Thigh_Adductor',
  'puxada alta na polia maquina': 'Lat_Pulldown',
  'crucifixo no voador maquina': 'Butterfly',
  'cadeira flexora maquina': 'Seated_Leg_Curl',
  'elevacao unilateral de panturrilha em pe maquina': 'Donkey_Calf_Raises',
  'extensao de perna unilateral maquina': 'Single-Leg_Leg_Extension',
  'elevacao lateral cabo': 'Side_Lateral_Raise',
  'abdominal corda': 'Cable_Crunch',
  'press de ombros sentada halter': 'Dumbbell_Shoulder_Press',
  'desenvolvimento de ombros maquina de placas': 'Machine_Shoulder_Military_Press',
  'hiperextensao reversa': 'Hyperextensions_Back_Extensions',
  'peso morto com pernas esticadas': 'Stiff-Legged_Barbell_Deadlift',
  'remo sentado maquina': 'Seated_Cable_Rows',
  'elevacao lateral maquina': 'Side_Lateral_Raise',
  'supino barra': 'Barbell_Bench_Press_-_Medium_Grip',
  'flexao de pernas em pe': 'Standing_Leg_Curl',
  'prensa de ombros sentada maquina': 'Machine_Shoulder_Military_Press',
  'aberturas invertidas de ombro posterior na maquina': 'Reverse_Machine_Flyes',
  'leg press 45 maquina': 'Leg_Press',
  'elevacao de panturrilha em pe maquina': 'Standing_Calf_Raises',
  'extensao de panturrilha maquina': 'Standing_Calf_Raises',
  'leg press horizontal maquina': 'Leg_Press',
  'triceps na polia': 'Triceps_Pushdown',
  'triceps na polia com corda': 'Triceps_Pushdown_-_Rope_Attachment',
  'rosca de punho halter': 'Palms-Up_Barbell_Wrist_Curl',
  'rosca mao ao contrario': 'Reverse_Barbell_Curl',
  'remada sentada com pegada em v cabo': 'Seated_Cable_Rows',
  'elevacao lateral unilateral cabo': 'Side_Lateral_Raise',
  'supino inclinado halter': 'Incline_Dumbbell_Press',
  'puxada alta maquina': 'Lat_Pulldown',
  'abdominal declinado com peso': 'Decline_Crunch',
  'rosca direta na polia': 'Cable_Curl',
  'supino inclinado na maquina': 'Incline_Dumbbell_Press',
  'cadeira extensora maquina': 'Leg_Extensions',
  'rosca invertida cabo': 'Reverse_Cable_Curl',
  'barra fixa com peso': 'Weighted_Pull_Ups',
  'barra fixa': 'Pullups',
  'elevacao de panturrilha sentado maquina': 'Seated_Calf_Raise',
  'supino inclinado barra': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  'extensao de triceps na polia maquina': 'Triceps_Pushdown',
  'triceps na paralela com peso': 'Weighted_Bench_Dip',
  'supino declinado maquina': 'Decline_Dumbbell_Bench_Press',
  'agachamento pendulo maquina': 'Hack_Squat',
  'shrug': 'Barbell_Shrug',
  'extensao de triceps acima da cabeca cabo': 'Cable_Rope_Overhead_Triceps_Extension',
  'extensao lombar maquina': 'Hyperextensions_Back_Extensions',
  'paralela': 'Bench_Dips',
  'agachamento bulgaro': 'One_Leg_Barbell_Squat',
  'caminhada': 'Walking_Lunge_Male',
  'corrida': 'Walking_Lunge_Male',
  'gluteo coice maquina': 'Glute_Kickback',
  'rosca direta halter': 'Dumbbell_Bicep_Curl',
  'triceps testa barra': 'Lying_Triceps_Press',
  'crucifixo na polia maquina': 'Cable_Crossover',
  'crucifixo sentado cabo': 'Cable_Crossover',
  'halo com kettlebell': 'Kettlebell_Halo',
  'press de ombros sentada barra': 'Barbell_Shoulder_Press',
  'puxada com o braco reto corda': 'Straight-Arm_Pulldown',
  'elevacao de pernas na barra fixa': 'Hanging_Leg_Raise',
  'rosca martelo com corda na polia': 'Cable_Hammer_Curl_-_Rope_Attachment',
  'remada unilateral na polia': 'Cable_One_Arm_Lat_Pulldown',
  'flexao de pescoco deitado com peso': 'Isometric_Neck_Exercise_-_Front_And_Back',
  'extensao de pescoco deitado com peso': 'Isometric_Neck_Exercise_-_Front_And_Back',
};

const EN_BY_NORM = {
  'extensao de triceps unilateral cabo': 'One Arm Triceps Extension (Cable)',
  'remada na barra t': 'T-Bar Row (Barbell)',
  'rosca scott halter': 'Preacher Curl (Dumbbell)',
  'cadeira adutora maquina': 'Thigh Adductor (Machine)',
  'puxada alta na polia maquina': 'Lat Pulldown (Machine)',
  'crucifixo no voador maquina': 'Pec Deck Fly (Machine)',
  'cadeira flexora maquina': 'Seated Leg Curl (Machine)',
  'elevacao unilateral de panturrilha em pe maquina': 'Single Leg Standing Calf Raise (Machine)',
  'extensao de perna unilateral maquina': 'Single Leg Extension (Machine)',
  'elevacao lateral cabo': 'Lateral Raise (Cable)',
  'abdominal corda': 'Cable Crunch (Rope)',
  'press de ombros sentada halter': 'Seated Shoulder Press (Dumbbell)',
  'desenvolvimento de ombros maquina de placas': 'Shoulder Press Plate Loaded (Machine)',
  'hiperextensao reversa': 'Reverse Hyperextension (Machine)',
  'peso morto com pernas esticadas': 'Stiff Leg Deadlift (Barbell)',
  'remo sentado maquina': 'Seated Row (Machine)',
  'elevacao lateral maquina': 'Lateral Raise (Machine)',
  'supino barra': 'Bench Press (Barbell)',
  'flexao de pernas em pe': 'Standing Leg Curl (Machine)',
  'prensa de ombros sentada maquina': 'Seated Shoulder Press (Machine)',
  'aberturas invertidas de ombro posterior na maquina': 'Reverse Fly (Machine)',
  'leg press 45 maquina': '45 Degree Leg Press (Machine)',
  'elevacao de panturrilha em pe maquina': 'Standing Calf Raise (Machine)',
  'leg press horizontal maquina': 'Horizontal Leg Press (Machine)',
  'triceps na polia': 'Triceps Pushdown (Cable)',
  'triceps na polia com corda': 'Triceps Pushdown Rope (Cable)',
  'rosca de punho halter': 'Wrist Curl (Dumbbell)',
  'rosca mao ao contrario': 'Reverse Curl (Barbell)',
  'supino inclinado halter': 'Incline Bench Press (Dumbbell)',
  'puxada alta maquina': 'Lat Pulldown (Machine)',
  'cadeira extensora maquina': 'Leg Extension (Machine)',
  'barra fixa': 'Pull-Up (Bodyweight)',
  'barra fixa com peso': 'Weighted Pull-Up',
  'supino inclinado barra': 'Incline Bench Press (Barbell)',
  'agachamento bulgaro': 'Bulgarian Split Squat',
  'caminhada': 'Walking',
  'corrida': 'Running',
  'shrug': 'Shrug (Barbell)',
  'halo com kettlebell': 'Halo (Kettlebell)',
  'gluteo coice maquina': 'Glute Kickback (Machine)',
  'rosca direta halter': 'Bicep Curl (Dumbbell)',
  'triceps testa barra': 'Skull Crusher (Barbell)',
  'paralela': 'Parallel Bar Dip (Bodyweight)',
  'extensao lombar maquina': 'Back Extension (Machine)',
};

function normalizeTitle(value) {
  return String(value || '')
    .replace(/\r?\n/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTitle(title) {
  return String(title || '')
    .replace(/\\n/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uuidFromKey(key) {
  const hash = createHash('sha1').update(`lyfttrack:hevy-promote:${key}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function esc(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function inferEquipment(title) {
  const n = normalizeTitle(title);
  if (/\bmaquina\b|\bmachine\b/.test(n)) return 'machine';
  if (/\bhalter\b|\bdumbbell\b/.test(n)) return 'dumbbell';
  if (/\bcabo\b|\bpolia\b|\bcable\b|\bcorda\b/.test(n)) return 'cable';
  if (/\bbarra\b|\bbarbell\b/.test(n)) return 'barbell';
  if (/\bkettlebell\b/.test(n)) return 'kettlebell';
  if (/\belastico\b|\bband\b/.test(n)) return 'cable';
  if (/\bcaminhada\b|\bcorrida\b|\bbarra fixa\b|\bparalela\b/.test(n)) return 'bodyweight';
  return 'machine';
}

function inferMuscle(title) {
  const n = normalizeTitle(title);
  // Other before shoulders: rotator cuff + neck isolation (not "behind the neck")
  if (
    /^(rotacao (externa|interna)|external rotation|internal rotation)\b/.test(n) ||
    /^(neck (extension|flexion)|isometric neck|pescoco)\b/.test(n) ||
    /\b(rotator|cuff|manguito|serratus|halo|caminhada|corrida|cardio)\b/.test(n)
  )
    return 'other';
  if (/panturrilha|calf/.test(n)) return 'calves';
  if (/triceps|tricep|testa|paralela|mergulho|jm /.test(n)) return 'triceps';
  if (/rosca|bicep|curl|punho|pulso|antebraco/.test(n)) return 'biceps';
  if (/adutora|gluteo|coice|pelvica|hip thrust/.test(n)) return 'glutes';
  if (/flexora|isquio|stiff|peso morto|hiperextensao|lombar|hamstring/.test(n)) return 'hamstrings';
  if (/extensora|extensao de perna|leg press|agachamento|lunge|hack|quad/.test(n)) return 'quadriceps';
  if (/supino|peito|crucifixo|voador|chest|pec /.test(n)) return 'chest';
  if (/ombros|ombro|elevacao lateral|elevacao frontal|desenvolvimento|prensa de ombros|press de ombros|shrug|deltoid/.test(n))
    return 'shoulders';
  if (/abdominal|crunch|core|joelhos/.test(n)) return 'core';
  if (/puxada|remada|remo|barra fixa|costas|lat |row|pulldown|tracao/.test(n)) return 'back';
  if (/punho|wrist|forearm/.test(n)) return 'forearms';
  return 'other';
}

function toEnglish(title) {
  const n = normalizeTitle(title);
  if (EN_BY_NORM[n]) return EN_BY_NORM[n];
  // Fallback: keep cleaned PT title as EN display (matcher still uses name_pt).
  return cleanTitle(title);
}

function imageUrlFor(title) {
  const n = normalizeTitle(title);
  const fedId = IMAGE_BY_NORM[n];
  if (!fedId) return null;
  return `${IMAGE_BASE}/${fedId}/0.jpg`;
}

function buildRows(candidates) {
  const rows = [];
  const skipped = [];
  for (const c of candidates) {
    const title = cleanTitle(c.title);
    const norm = normalizeTitle(title);
    if (!title || !norm) continue;
    if (PERSONAL.has(norm)) {
      skipped.push({ title, reason: 'personal' });
      continue;
    }
    const muscle = inferMuscle(title);
    const equipment = inferEquipment(title);
    const labels = MUSCLE_LABEL[muscle] || MUSCLE_LABEL.other;
    const nameEn = toEnglish(title);
    rows.push({
      id: uuidFromKey(norm),
      name: nameEn,
      name_en: nameEn,
      name_pt: title,
      muscle_group: muscle,
      muscle_en: labels.en,
      muscle_pt: labels.pt,
      equipment,
      is_custom: false,
      image_url: imageUrlFor(title),
      setRows: c.setRows,
      tokenKey: c.tokenKey,
    });
  }
  return { rows, skipped };
}

function writeSql(rows) {
  const lines = [
    '-- Hevy CSV candidates promoted to public catalogue — issue #112',
    '-- Personal customs excluded. Idempotent upsert by id.',
    'begin;',
    'insert into public.exercises (id, name, name_en, name_pt, muscle_group, muscle_en, muscle_pt, equipment, is_custom, created_by, image_url, description) values',
  ];
  const values = rows.map(
    (r, i) =>
      `  (${esc(r.id)}::uuid, ${esc(r.name)}, ${esc(r.name_en)}, ${esc(r.name_pt)}, ${esc(r.muscle_group)}, ${esc(r.muscle_en)}, ${esc(r.muscle_pt)}, ${esc(r.equipment)}, false, null, ${esc(r.image_url)}, null)${i === rows.length - 1 ? '' : ','}`
  );
  lines.push(...values);
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
  lines.push('commit;');
  return lines.join('\n');
}

function main() {
  const apply = process.argv.includes('--apply');
  if (!existsSync(REVIEW)) {
    console.error('Missing', REVIEW, '— run hevy-catalog-review.mjs first');
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(REVIEW, 'utf8'));
  const { rows, skipped } = buildRows(report.candidates || []);
  mkdirSync(dirname(OUT_SQL), { recursive: true });
  writeFileSync(OUT_SQL, writeSql(rows), 'utf8');
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        promoted: rows.length,
        skippedPersonal: skipped,
        rows: rows.map(({ id, name_en, name_pt, muscle_group, equipment, image_url, setRows }) => ({
          id,
          name_en,
          name_pt,
          muscle_group,
          equipment,
          image_url,
          setRows,
        })),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Promoted: ${rows.length}`);
  console.log(`Skipped personal: ${skipped.length}`);
  for (const s of skipped) console.log(`  - ${s.title}`);
  console.log(`Wrote ${OUT_SQL}`);
  console.log(`Wrote ${OUT_JSON}`);
  console.assert(rows.length > 80, 'expected ~90 promotions');
  console.assert(skipped.length >= 6, 'expected personal skips');

  if (apply) {
    const proc = spawnSync(
      'npx',
      ['supabase', 'db', 'query', '--linked', '-f', OUT_SQL],
      { cwd: ROOT, encoding: 'utf8', shell: true }
    );
    if (proc.status !== 0) {
      console.error(proc.stderr || proc.stdout);
      process.exit(proc.status || 1);
    }
    console.log('Applied to linked DB.');
  }
}

main();
