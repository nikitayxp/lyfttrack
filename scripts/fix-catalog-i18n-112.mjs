/**
 * Fix catalogue rows where name_en is still Portuguese (#112).
 * Keeps name_pt; sets proper English name_en (+ name mirror).
 *
 * Usage: node scripts/fix-catalog-i18n-112.mjs [--apply]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'tmp');
const OUT_SQL = join(ROOT, 'supabase', 'seeds', 'hevy_fix_i18n_112.sql');
const PROMOTE_PREVIEW = join(ROOT, 'supabase', 'seeds', 'hevy_promote_112.preview.json');

const PT_MARKERS =
  /\b(ombros?|halter|halteres|maquina|polia|cabo|rosca|supino|agachamento|remada|remo|puxada|elevacao|desenvolvimento|extensao|cadeira|mesa|panturrilha|triceps|pernas?|sentada|sentado|punho|peito|costas|gluteo|coice|paralela|lombar|joelhos|pescoco|crucifixo|adutora|flexora|extensora|voador|prensa|pegada|dobradas|iso)\b/i;

const PT_TO_EN = [
  ['elevacao lateral', 'Lateral Raise'],
  ['elevacao frontal', 'Front Raise'],
  ['elevacao de panturrilha', 'Calf Raise'],
  ['elevacao pelvica', 'Hip Thrust'],
  ['desenvolvimento', 'Shoulder Press'],
  ['press de ombros', 'Shoulder Press'],
  ['prensa de ombros', 'Shoulder Press'],
  ['supino inclinado', 'Incline Bench Press'],
  ['supino declinado', 'Decline Bench Press'],
  ['supino', 'Bench Press'],
  ['rosca scott', 'Preacher Curl'],
  ['rosca martelo', 'Hammer Curl'],
  ['rosca direta', 'Bicep Curl'],
  ['rosca invertida', 'Reverse Curl'],
  ['rosca de punho', 'Wrist Curl'],
  ['rosca punho', 'Wrist Curl'],
  ['rosca', 'Curl'],
  ['remada', 'Row'],
  ['remo sentado', 'Seated Row'],
  ['puxada alta', 'Lat Pulldown'],
  ['puxada', 'Pulldown'],
  ['agachamento bulgaro', 'Bulgarian Split Squat'],
  ['agachamento pendulo', 'Pendulum Squat'],
  ['agachamento pistola', 'Pistol Squat'],
  ['agachamento', 'Squat'],
  ['extensao de triceps', 'Triceps Extension'],
  ['extensao de perna', 'Leg Extension'],
  ['extensao de punho', 'Wrist Extension'],
  ['extensao lombar', 'Back Extension'],
  ['extensao de pescoco', 'Neck Extension'],
  ['extensao', 'Extension'],
  ['cadeira adutora', 'Thigh Adductor'],
  ['cadeira flexora', 'Seated Leg Curl'],
  ['cadeira extensora', 'Leg Extension'],
  ['mesa flexora', 'Lying Leg Curl'],
  ['crucifixo', 'Fly'],
  ['abdominal', 'Crunch'],
  ['barra fixa', 'Pull-Up'],
  ['hiperextensao reversa', 'Reverse Hyperextension'],
  ['peso morto', 'Deadlift'],
  ['gluteo coice', 'Glute Kickback'],
  ['triceps na polia', 'Triceps Pushdown'],
  ['triceps na paralela', 'Dip'],
  ['triceps testa', 'Skull Crusher'],
  ['flexao de pernas', 'Leg Curl'],
  ['flexao de pescoco', 'Neck Flexion'],
  ['levantamento de joelhos', 'Hanging Knee Raise'],
  ['sentada', 'Seated'],
  ['sentado', 'Seated'],
  ['unilateral', 'Single Arm'],
  ['inclinado', 'Incline'],
  ['declinado', 'Decline'],
  ['em pe', 'Standing'],
];

function normalize(value) {
  return String(value || '')
    .replace(/\\n/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(value) {
  return String(value || '')
    .replace(/\\n/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function esc(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function eqParen(equipment) {
  return (
    {
      barbell: 'Barbell',
      dumbbell: 'Dumbbell',
      machine: 'Machine',
      cable: 'Cable',
      bodyweight: 'Bodyweight',
      kettlebell: 'Kettlebell',
    }[equipment] || null
  );
}

function translatePtToEn(namePt, equipment) {
  let out = normalize(namePt);
  // strip equipment words; re-add paren later
  out = out
    .replace(/\b(halteres|halter|barra|maquina|polia|cabo|corda|kettlebell)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [pt, en] of PT_TO_EN.sort((a, b) => b[0].length - a[0].length)) {
    if (out.includes(pt)) out = out.replace(pt, ` ${en.toLowerCase()} `);
  }
  out = out
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const label = eqParen(equipment);
  if (label && out && !new RegExp(`\\(${label}\\)$`, 'i').test(out)) out = `${out} (${label})`;
  return out || null;
}

function looksPt(text) {
  return PT_MARKERS.test(normalize(text));
}

function loadCatalog() {
  const tmpSql = join(OUT_DIR, '_i18n_query.sql');
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    tmpSql,
    `select id, name, name_en, name_pt, equipment from public.exercises where is_custom = false;\n`,
    'utf8'
  );
  const proc = spawnSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '-f', tmpSql, '--output-format', 'json'],
    { cwd: ROOT, encoding: 'utf8', shell: true }
  );
  if (proc.status !== 0) throw new Error(proc.stderr || proc.stdout);
  return JSON.parse(proc.stdout.slice(proc.stdout.indexOf('{'))).rows || [];
}

function main() {
  const apply = process.argv.includes('--apply');
  const catalog = loadCatalog();
  const promote = existsSync(PROMOTE_PREVIEW)
    ? JSON.parse(readFileSync(PROMOTE_PREVIEW, 'utf8')).rows || []
    : [];
  const enByPt = new Map();
  for (const r of promote) {
    if (r.name_pt && r.name_en && !looksPt(r.name_en)) {
      enByPt.set(normalize(r.name_pt), r.name_en);
    }
  }

  const updates = [];
  for (const row of catalog) {
    let nameEn = clean(row.name_en || row.name);
    let namePt = clean(row.name_pt || row.name);
    let changed = nameEn !== (row.name_en || '') || namePt !== (row.name_pt || '');

    if (looksPt(nameEn)) {
      const fromPromote = enByPt.get(normalize(namePt));
      const translated = fromPromote || translatePtToEn(namePt, row.equipment);
      if (translated && !looksPt(translated)) {
        nameEn = translated;
        changed = true;
      }
    }

    // Fix leftover English crumbs in PT
    if (/\bmedium grip\b/i.test(namePt)) {
      namePt = namePt.replace(/\s*Medium Grip\s*/i, ' ').replace(/\s+/g, ' ').trim();
      changed = true;
    }

    if (!changed) continue;
    updates.push({ id: row.id, name: nameEn, name_en: nameEn, name_pt: namePt });
  }

  const lines = ['-- Fix PT-in-EN catalogue labels (#112)', 'begin;'];
  for (const u of updates) {
    lines.push(
      `update public.exercises set name = ${esc(u.name)}, name_en = ${esc(u.name_en)}, name_pt = ${esc(u.name_pt)} where id = ${esc(u.id)}::uuid;`
    );
  }
  lines.push('commit;');
  mkdirSync(dirname(OUT_SQL), { recursive: true });
  writeFileSync(OUT_SQL, lines.join('\n'), 'utf8');
  console.log(`i18n fixes: ${updates.length}`);
  console.log(updates.slice(0, 12).map((u) => `${u.name_pt} → ${u.name_en}`).join('\n'));
  console.log(`Wrote ${OUT_SQL}`);
  console.assert(updates.length > 10, 'expected multiple i18n fixes');

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
    console.log('Applied.');
  }
}

main();
