/**
 * Slim public catalogue (#112 option A):
 * - Prefer Hevy-used exercises as the listed set
 * - 1 listed row per movement+equipment cluster (prefer seated/machine over standing)
 * - Losers stay in DB with listed=false; names go to winner aliases for import
 *
 * Usage:
 *   node scripts/slim-catalog-112.mjs
 *   node scripts/slim-catalog-112.mjs --apply
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'tmp');
const OUT_SQL = join(ROOT, 'supabase', 'seeds', 'hevy_slim_catalog_112.sql');
const OUT_REPORT = join(OUT_DIR, 'hevy-slim-report.json');
const REVIEW = join(OUT_DIR, 'hevy-catalog-review.json');
const MIG = join(ROOT, 'supabase', 'migrations', '20260803170000_exercise_listed.sql');

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
  ].map(normalize)
);

const EQUIPMENT_TOKENS = new Set([
  'barbell', 'barra', 'dumbbell', 'halter', 'machine', 'maquina', 'cable', 'polia', 'cabo',
  'bodyweight', 'kettlebell', 'rope', 'corda',
]);

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

function tokens(value) {
  return normalize(value).split(' ').filter(Boolean);
}

function movementTokens(value) {
  return tokens(value).filter((t) => !EQUIPMENT_TOKENS.has(t) && t.length > 1);
}

function modifiers(value) {
  const t = new Set(tokens(value));
  const mods = new Set();
  if (t.has('incline') || t.has('inclinado')) mods.add('incline');
  if (t.has('decline') || t.has('declinado')) mods.add('decline');
  if (t.has('seated') || t.has('sentada') || t.has('sentado') || t.has('sentadas')) mods.add('seated');
  if (t.has('standing') || (t.has('pe') && t.has('em'))) mods.add('standing');
  if (t.has('lying') || t.has('deitado')) mods.add('lying');
  if ((t.has('one') && t.has('arm')) || t.has('unilateral')) mods.add('one_arm');
  if (t.has('single') && t.has('leg')) mods.add('single_leg');
  if (t.has('smith')) mods.add('smith');
  if (t.has('reverse') || t.has('invertida') || t.has('invertido')) mods.add('reverse');
  return mods;
}

/** Cluster key: equipment + hard modifiers + core movement (seated/standing collapsed). */
function clusterKey(row) {
  const eq = row.equipment || 'other';
  const label = row.name_en || row.name || row.name_pt || '';
  const mods = modifiers(label);
  const hard = ['incline', 'decline', 'lying', 'one_arm', 'single_leg', 'smith', 'reverse']
    .filter((m) => mods.has(m))
    .sort()
    .join('+');
  const core = movementTokens(label)
    .filter((t) => !['seated', 'standing', 'sentada', 'sentado', 'sentadas', 'em', 'pe'].includes(t))
    .sort()
    .join(' ');
  return `${eq}::${hard}::${core || normalize(label)}`;
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

function esc(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function escArray(arr) {
  const uniq = [...new Set((arr || []).map((s) => String(s).trim()).filter(Boolean))];
  if (!uniq.length) return `'{}'::text[]`;
  return `ARRAY[${uniq.map(esc).join(', ')}]::text[]`;
}

function loadCatalog() {
  mkdirSync(OUT_DIR, { recursive: true });
  const tmpSql = join(OUT_DIR, '_slim_catalog_query.sql');
  writeFileSync(
    tmpSql,
    `select id, name, name_en, name_pt, equipment, muscle_group, image_url, coalesce(aliases,'{}') as aliases, coalesce(listed, true) as listed
     from public.exercises where is_custom = false;\n`,
    'utf8'
  );
  const proc = spawnSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '-f', tmpSql, '--output-format', 'json'],
    { cwd: ROOT, encoding: 'utf8', shell: true }
  );
  if (proc.status !== 0) throw new Error(proc.stderr || proc.stdout || 'db query failed');
  const payload = JSON.parse(proc.stdout.slice(proc.stdout.indexOf('{')));
  return (payload.rows || []).map((r) => ({
    ...r,
    aliases: Array.isArray(r.aliases) ? r.aliases : [],
  }));
}

function loadHevyUsage() {
  if (!existsSync(REVIEW)) return [];
  const report = JSON.parse(readFileSync(REVIEW, 'utf8'));
  const rows = [...(report.matched || []), ...(report.candidates || [])];
  return rows
    .filter((r) => r.title && !PERSONAL.has(normalize(r.title)))
    .map((r) => ({ title: r.title, setRows: r.setRows || 0, exerciseId: r.exerciseId || null }));
}

function indexCatalogNames(catalog) {
  const exact = new Map();
  for (const row of catalog) {
    for (const name of [row.name, row.name_en, row.name_pt, ...(row.aliases || [])]) {
      if (!name) continue;
      const key = normalize(name);
      if (!key) continue;
      if (!exact.has(key)) exact.set(key, row);
    }
  }
  return exact;
}

function bestRowForTitle(title, catalog, byExact) {
  const hit = byExact.get(normalize(title));
  if (hit) return hit;
  const tTok = movementTokens(title);
  let best = null;
  let bestScore = 0;
  for (const row of catalog) {
    const label = `${row.name_en || ''} ${row.name_pt || ''}`;
    if ((row.equipment || '') && /maquina|machine|halter|dumbbell|cabo|cable|polia|barra|barbell/i.test(title)) {
      // soft: prefer same equipment when title implies it
    }
    const score = jaccard(tTok, movementTokens(label));
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

function scoreRow(row, hevyUsage) {
  const label = `${row.name_en || ''} ${row.name_pt || ''}`;
  const mods = modifiers(label);
  const isPress = /\b(press|desenvolvimento|prensa)\b/i.test(label);
  const isRaise = /\b(raise|elevacao|elevação)\b/i.test(label);
  let score = hevyUsage;

  // Presses: prefer seated/machine over standing free-weight.
  if (isPress && mods.has('seated')) score += 40;
  if (isPress && mods.has('standing')) score -= 30;
  // Laterals/raises: prefer standing (Hevy "Elevação Lateral (Halter)" is standing).
  if (isRaise && mods.has('standing')) score += 20;
  if (isRaise && mods.has('seated')) score -= 15;

  if ((row.equipment || '') === 'machine') score += 25;
  if ((row.equipment || '') === 'cable') score += 5;
  if (row.name_en && !/[áàãâéêíóôõúç]/i.test(row.name_en) && !/\b(ombros|halter|maquina|rosca)\b/i.test(row.name_en)) {
    score += 8;
  }
  if (/shoulder press|desenvolvimento/i.test(label)) score += 10;
  if (/^press sentado$|^seated press$/i.test(normalize(stripEquip(label)))) score -= 20;

  return score;
}

function stripEquip(label) {
  return label.replace(/\([^)]*\)/g, ' ');
}

function main() {
  const apply = process.argv.includes('--apply');
  spawnSync('npx', ['supabase', 'db', 'query', '--linked', '-f', MIG], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });

  const catalog = loadCatalog();
  const hevy = loadHevyUsage();
  const byExact = indexCatalogNames(catalog);
  const usageById = new Map();

  for (const h of hevy) {
    const row = h.exerciseId
      ? catalog.find((c) => c.id === h.exerciseId)
      : bestRowForTitle(h.title, catalog, byExact);
    if (!row) continue;
    usageById.set(row.id, (usageById.get(row.id) || 0) + h.setRows);
    // ensure hevy title becomes alias later
    row._hevyTitles = row._hevyTitles || [];
    row._hevyTitles.push(h.title);
  }

  // Seed keepers: any row with Hevy usage
  const keeperIds = new Set([...usageById.keys()]);
  // If Hevy matched nothing for a title, we still want a public listed target — already handled via usageById

  // Cluster ALL catalog rows; only Hevy-touched clusters keep a listed winner.
  // Non-Hevy clusters → all listed=false (encyclopedia off).
  const clusters = new Map();
  for (const row of catalog) {
    const key = clusterKey(row);
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(row);
  }

  const listedIds = new Set();
  const aliasAdds = new Map(); // winnerId -> Set aliases
  const decisions = [];

  for (const [key, rows] of clusters) {
    const touched = rows.some((r) => usageById.has(r.id));
    if (!touched) {
      for (const r of rows) {
        decisions.push({ id: r.id, name_en: r.name_en, listed: false, reason: `no-hevy ${key}` });
      }
      continue;
    }

    const ranked = [...rows].sort(
      (a, b) => scoreRow(b, usageById.get(b.id) || 0) - scoreRow(a, usageById.get(a.id) || 0)
    );
    const winner = ranked[0];
    listedIds.add(winner.id);
    if (!aliasAdds.has(winner.id)) aliasAdds.set(winner.id, new Set(winner.aliases || []));

    for (const title of winner._hevyTitles || []) aliasAdds.get(winner.id).add(title);

    decisions.push({
      id: winner.id,
      name_en: winner.name_en,
      listed: true,
      reason: `winner ${key} score=${scoreRow(winner, usageById.get(winner.id) || 0)} hevy=${usageById.get(winner.id) || 0}`,
    });

    for (const loser of ranked.slice(1)) {
      decisions.push({
        id: loser.id,
        name_en: loser.name_en,
        listed: false,
        reason: `lost-to ${winner.name_en}`,
      });
      const set = aliasAdds.get(winner.id);
      for (const n of [loser.name, loser.name_en, loser.name_pt, ...(loser.aliases || [])]) {
        if (n) set.add(n);
      }
      for (const title of loser._hevyTitles || []) set.add(title);
    }
  }

  // Safety: every Hevy-mapped id must be listed OR aliased onto a listed winner
  for (const id of keeperIds) {
    if (listedIds.has(id)) continue;
    // find winner in same cluster
    const row = catalog.find((c) => c.id === id);
    if (!row) continue;
    const peers = clusters.get(clusterKey(row)) || [];
    const winner = peers.find((p) => listedIds.has(p.id));
    if (winner) {
      const set = aliasAdds.get(winner.id) || new Set();
      for (const n of [row.name, row.name_en, row.name_pt, ...(row._hevyTitles || [])]) if (n) set.add(n);
      aliasAdds.set(winner.id, set);
    }
  }

  const lines = [
    '-- Slim catalogue picker (#112) — listed flag + aliases',
    'begin;',
    `alter table public.exercises add column if not exists listed boolean not null default true;`,
    // default all public to unlisted, then turn winners on
    `update public.exercises set listed = false where is_custom = false;`,
  ];

  for (const id of listedIds) {
    const aliases = [...(aliasAdds.get(id) || [])].filter((a) => {
      const row = catalog.find((c) => c.id === id);
      return a && normalize(a) !== normalize(row?.name_en) && normalize(a) !== normalize(row?.name_pt);
    });
    lines.push(
      `update public.exercises set listed = true, aliases = ${escArray(aliases)} where id = ${esc(id)}::uuid;`
    );
  }

  // Ensure customs always listed for their owners (picker shows customs separately anyway)
  lines.push(`update public.exercises set listed = true where is_custom = true;`);
  lines.push('commit;');

  mkdirSync(dirname(OUT_SQL), { recursive: true });
  writeFileSync(OUT_SQL, lines.join('\n'), 'utf8');
  writeFileSync(
    OUT_REPORT,
    JSON.stringify(
      {
        publicTotal: catalog.length,
        listedCount: listedIds.size,
        unlistedCount: catalog.length - listedIds.size,
        listed: decisions.filter((d) => d.listed).map((d) => ({ name_en: d.name_en, reason: d.reason })),
        sampleUnlisted: decisions.filter((d) => !d.listed).slice(0, 40),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Public: ${catalog.length}`);
  console.log(`Listed (picker): ${listedIds.size}`);
  console.log(`Unlisted (aliases/history): ${catalog.length - listedIds.size}`);
  console.log(`Wrote ${OUT_SQL}`);
  console.log('Listed sample:');
  for (const d of decisions.filter((x) => x.listed).slice(0, 25)) {
    console.log(`  ✓ ${d.name_en}`);
  }

  console.assert(listedIds.size > 30 && listedIds.size < 200, 'listed count should be slim but non-empty');
  const seatedPress = decisions.find((d) => d.name_en === 'Seated Press (Dumbbell)');
  const seatedShoulder = decisions.find((d) => d.name_en === 'Seated Shoulder Press (Dumbbell)');
  if (seatedPress && seatedShoulder) {
    console.assert(!seatedPress.listed && seatedShoulder.listed, 'Seated Press hidden; Seated Shoulder Press listed');
  }

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
