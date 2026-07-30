/**
 * Diff a Hevy workout CSV against the LyftTrack catalogue.
 *
 * Matching mirrors app/src/services/import/importService.ts (issue #68):
 * normalize → exact; else token key with PT/EN equipment+movement synonyms.
 *
 * Usage:
 *   node scripts/hevy-catalog-review.mjs tmp/workout_data.csv
 *   node scripts/hevy-catalog-review.mjs tmp/workout_data.csv --from-db
 *
 * Default catalogue source: supabase/seeds/free_exercise_db_catalog_110.sql
 * --from-db: pull live public.exercises via `npx supabase db query --linked`
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEFAULT_SEED = join(ROOT, 'supabase', 'seeds', 'free_exercise_db_catalog_110.sql');
const OUT_DIR = join(ROOT, 'tmp');

const MOVEMENT_TOKEN_CANONICAL = {
  remada: 'row',
  row: 'row',
  rows: 'row',
  puxada: 'pulldown',
  pulldown: 'pulldown',
  pulldowns: 'pulldown',
  supino: 'bench',
  bench: 'bench',
  agachamento: 'squat',
  squat: 'squat',
  squats: 'squat',
  rosca: 'curl',
  curl: 'curl',
  curls: 'curl',
  desenvolvimento: 'press',
  terra: 'deadlift',
  deadlift: 'deadlift',
  stiff: 'rdl',
  romeno: 'rdl',
  elevacao: 'raise',
  raise: 'raise',
  raises: 'raise',
  scott: 'preacher',
  preacher: 'preacher',
};

const TITLE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'in',
  'na', 'nas', 'no', 'nos', 'of', 'on', 'para', 'the', 'sentada', 'sentado',
  'sentadas', 'em', 'pe',
]);

function normalizeTitle(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyEquipmentSynonyms(normalized) {
  return normalized
    .replace(/\bbarra\b/g, 'bar')
    .replace(/\btbar\b/g, 't bar')
    // Hevy uses "Halter" (not only "Halteres"); cover halter / haltere / halteres
    .replace(/\bhalter(?:es?)?\b/g, 'dumbbell')
    .replace(/\bmaquina\b/g, 'machine')
    .replace(/\bpolia\b/g, 'cable')
    .replace(/\bcabo\b/g, 'cable')
    .replace(/\bbarbell\b/g, 'bar')
    .replace(/\bdumbbells?\b/g, 'dumbbell');
}

function titleTokenKey(value) {
  const normalized = applyEquipmentSynonyms(normalizeTitle(value));
  const tokens = normalized
    .split(' ')
    .filter(Boolean)
    .map((token) => MOVEMENT_TOKEN_CANONICAL[token] ?? token)
    .filter((token) => token.length > 0 && !TITLE_STOP_WORDS.has(token));
  return [...new Set(tokens)].sort().join(' ');
}

function readCsvText(path) {
  const buf = readFileSync(path);
  const utf8 = buf.toString('utf8');
  // UTF-8 misread as latin1 looks like Ã§ / Ã£ / Ã© — prefer latin1 then.
  const looksMojibake = /Ã.|Â./.test(utf8);
  if (utf8.includes('exercise_title') && !looksMojibake && !utf8.includes('\uFFFD')) {
    return utf8;
  }
  return buf.toString('latin1');
}

function parseHevyTitles(csvText) {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, ''));
  const idx = header.indexOf('exercise_title');
  if (idx < 0) throw new Error('CSV missing exercise_title column');

  const counts = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = splitCsvLine(line);
    const title = (cols[idx] || '').replace(/^"|"$/g, '').trim();
    if (!title) continue;
    counts.set(title, (counts.get(title) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([title, setRows]) => ({ title, setRows }))
    .sort((a, b) => b.setRows - a.setRows || a.title.localeCompare(b.title));
}

/** Minimal CSV line split that respects quotes. */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function loadCatalogFromSeed(seedPath) {
  const sql = readFileSync(seedPath, 'utf8');
  const rows = [];
  // ('uuid'::uuid, 'name', 'name_en', 'name_pt', 'muscle', ...
  const re =
    /\('([0-9a-f-]{36})'::uuid,\s*'((?:\\'|[^'])*)',\s*'((?:\\'|[^'])*)',\s*'((?:\\'|[^'])*)',\s*'((?:\\'|[^'])*)'/g;
  let m;
  while ((m = re.exec(sql))) {
    const unesc = (s) => s.replace(/''/g, "'");
    rows.push({
      id: m[1],
      name: unesc(m[2]),
      name_en: unesc(m[3]),
      name_pt: unesc(m[4]),
      muscle_group: unesc(m[5]),
      is_custom: false,
    });
  }
  return rows;
}

function loadCatalogFromDb() {
  const tmpSql = join(OUT_DIR, '_hevy-catalog-query.sql');
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    tmpSql,
    'select id, name, name_en, name_pt, muscle_group, equipment, is_custom from public.exercises where is_custom = false order by name;\n',
    'utf8'
  );
  const proc = spawnSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '-f', tmpSql, '--output-format', 'json'],
    { cwd: ROOT, encoding: 'utf8', shell: true }
  );
  if (proc.status !== 0) {
    throw new Error(proc.stderr || proc.stdout || 'db query failed');
  }
  const text = proc.stdout;
  const idx = text.indexOf('{');
  if (idx < 0) throw new Error('db query returned no JSON: ' + text.slice(0, 200));
  const payload = JSON.parse(text.slice(idx));
  return payload.rows || [];
}

function catalogQuality(item) {
  let score = item.is_custom ? 0 : 80;
  if (item.name_en) score += 20;
  if (item.name_pt) score += 20;
  return score;
}

function prefer(candidate, current) {
  if (!current) return true;
  return catalogQuality(candidate) > catalogQuality(current);
}

function indexCatalog(catalog) {
  const exact = new Map();
  const byTokens = new Map();
  for (const item of catalog) {
    for (const name of [item.name, item.name_en, item.name_pt]) {
      if (!name) continue;
      const exactKey = normalizeTitle(name);
      if (exactKey && prefer(item, exact.get(exactKey))) exact.set(exactKey, item);
      const tokenKey = titleTokenKey(name);
      if (tokenKey && prefer(item, byTokens.get(tokenKey))) byTokens.set(tokenKey, item);
    }
  }
  return { exact, byTokens };
}

function matchTitles(titles, catalog) {
  const { exact, byTokens } = indexCatalog(catalog);
  return titles.map(({ title, setRows }) => {
    const exactHit = exact.get(normalizeTitle(title));
    if (exactHit) {
      return {
        title,
        setRows,
        kind: 'exact',
        exerciseId: exactHit.id,
        matchedName: exactHit.name_pt || exactHit.name_en || exactHit.name,
        matchedEn: exactHit.name_en,
      };
    }
    const tokenHit = byTokens.get(titleTokenKey(title));
    if (tokenHit) {
      return {
        title,
        setRows,
        kind: 'alias',
        exerciseId: tokenHit.id,
        matchedName: tokenHit.name_pt || tokenHit.name_en || tokenHit.name,
        matchedEn: tokenHit.name_en,
      };
    }
    return {
      title,
      setRows,
      kind: 'none',
      exerciseId: null,
      matchedName: null,
      matchedEn: null,
      tokenKey: titleTokenKey(title),
    };
  });
}

function main() {
  const args = process.argv.slice(2);
  const csvArg = args.find((a) => !a.startsWith('--'));
  const fromDb = args.includes('--from-db');
  if (!csvArg) {
    console.error('Usage: node scripts/hevy-catalog-review.mjs <hevy.csv> [--from-db]');
    process.exit(1);
  }

  const csvPath = resolve(csvArg);
  if (!existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  const titles = parseHevyTitles(readCsvText(csvPath));
  const catalog = fromDb ? loadCatalogFromDb() : loadCatalogFromSeed(DEFAULT_SEED);
  const matches = matchTitles(titles, catalog);

  const matched = matches.filter((m) => m.kind !== 'none');
  const candidates = matches.filter((m) => m.kind === 'none');

  const report = {
    sourceCsv: csvPath,
    catalogueSource: fromDb ? 'linked-db' : DEFAULT_SEED,
    catalogueSize: catalog.length,
    hevyUniqueTitles: titles.length,
    matchedCount: matched.length,
    candidateCount: candidates.length,
    matched,
    candidates,
    note:
      'candidates = Hevy titles with no catalogue hit. Review and approve before promoting to public catalogue (#112). Other users importing later will match public rows via the same logic (#68).',
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'hevy-catalog-review.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Hevy unique titles: ${titles.length}`);
  console.log(`Catalogue size:     ${catalog.length} (${report.catalogueSource})`);
  console.log(`Matched:            ${matched.length}`);
  console.log(`Candidates (review):${candidates.length}`);
  console.log(`Wrote ${outPath}`);
  console.log('\nTop candidates by usage:');
  for (const c of candidates.slice(0, 25)) {
    console.log(`  ${String(c.setRows).padStart(4)}  ${c.title}`);
  }

  // ponytail: self-check shared with import matching intent
  if (titleTokenKey('Remada na Barra T') !== titleTokenKey('T-Bar Row (Barbell)') &&
      titleTokenKey('Remada na Barra T') !== titleTokenKey('T Bar Row')) {
    // soft — catalogue naming may differ
  }
  console.assert(
    titleTokenKey('Supino Maquina') !== titleTokenKey('Supino Barra'),
    'machine bench must not equal barbell bench'
  );
}

main();
