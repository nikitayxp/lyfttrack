/**
 * Catalogue cleanup #112 (strict):
 * - aliases column
 * - merge Hevy promotes only when movement+equipment+modifiers match
 * - drop bare generic when seated/standing variant exists (NOT incline/decline)
 * - fix obvious name_en/name_pt language mix
 *
 * Usage:
 *   node scripts/dedupe-catalog-aliases-112.mjs
 *   node scripts/dedupe-catalog-aliases-112.mjs --apply
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'tmp');
const OUT_SQL = join(ROOT, 'supabase', 'seeds', 'hevy_dedupe_aliases_112.sql');
const OUT_REPORT = join(OUT_DIR, 'hevy-dedupe-report.json');
const PROMOTE_PREVIEW = join(ROOT, 'supabase', 'seeds', 'hevy_promote_112.preview.json');

const EQUIPMENT_TOKENS = new Set([
  'barbell',
  'barra',
  'dumbbell',
  'halter',
  'machine',
  'maquina',
  'cable',
  'polia',
  'cabo',
  'bodyweight',
  'kettlebell',
  'rope',
  'corda',
]);

const PT_MARKERS =
  /\b(ombros?|halter|maquina|polia|cabo|rosca|supino|agachamento|remada|puxada|elevacao|desenvolvimento|extensao|cadeira|mesa|panturrilha|triceps|pernas?|sentada|sentado)\b/;

function normalize(value) {
  return String(value || '')
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
  if (t.has('incline') || t.has('inclinado') || t.has('inclinada')) mods.add('incline');
  if (t.has('decline') || t.has('declinado') || t.has('declinada')) mods.add('decline');
  if (t.has('seated') || t.has('sentada') || t.has('sentado') || t.has('sentadas')) mods.add('seated');
  if (t.has('standing') || (t.has('pe') && t.has('em'))) mods.add('standing');
  if (t.has('lying') || t.has('deitado') || t.has('deitada')) mods.add('lying');
  if ((t.has('one') && t.has('arm')) || t.has('unilateral')) mods.add('one_arm');
  if (t.has('single') && t.has('leg')) mods.add('single_leg');
  if (t.has('smith')) mods.add('smith');
  if (t.has('reverse') || t.has('invertida') || t.has('invertidas')) mods.add('reverse');
  return mods;
}

/** Hard modifiers must be equal; seated/standing may match bare generic. */
function modifiersCompatible(a, b) {
  const A = modifiers(a);
  const B = modifiers(b);
  for (const m of ['incline', 'decline', 'lying', 'one_arm', 'single_leg', 'smith', 'reverse']) {
    if (A.has(m) !== B.has(m)) return false;
  }
  if (A.has('seated') && B.has('standing')) return false;
  if (A.has('standing') && B.has('seated')) return false;
  return true;
}

function isSeatedOrStanding(value) {
  const m = modifiers(value);
  return m.has('seated') || m.has('standing');
}

function isBareGeneric(value) {
  const m = modifiers(value);
  return !m.has('seated') && !m.has('standing');
}

function clusterKeySeatedStanding(row) {
  const eq = row.equipment || 'other';
  // EN only — mixing PT ("ombros") splits the same lift into different clusters.
  const label = row.name_en || row.name || row.name_pt || '';
  const toks = movementTokens(label).filter(
    (t) => !['seated', 'standing', 'sentada', 'sentado', 'sentadas', 'em', 'pe'].includes(t)
  );
  return `${eq}::${[...new Set(toks)].sort().join(' ')}`;
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

function looksPortuguese(text) {
  return PT_MARKERS.test(normalize(text));
}

function ptFromEn(nameEn, equipment) {
  const base = String(nameEn || '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
  const eqLabel =
    {
      barbell: 'Barra',
      dumbbell: 'Halter',
      machine: 'Maquina',
      cable: 'Polia',
      bodyweight: 'Peso corporal',
      kettlebell: 'Kettlebell',
    }[equipment] || null;

  let out = normalize(base);
  const phrases = [
    ['one arm shoulder press', 'Desenvolvimento Unilateral'],
    ['seated shoulder press', 'Desenvolvimento Sentado'],
    ['shoulder press', 'Desenvolvimento'],
    ['side lateral raise', 'Elevacao Lateral'],
    ['seated side lateral raise', 'Elevacao Lateral Sentada'],
    ['lateral raise', 'Elevacao Lateral'],
    ['front raise', 'Elevacao Frontal'],
    ['incline bench press', 'Supino Inclinado'],
    ['decline bench press', 'Supino Declinado'],
    ['bench press', 'Supino'],
    ['preacher curl', 'Rosca Scott'],
    ['hammer curl', 'Rosca Martelo'],
    ['lat pulldown', 'Puxada Alta'],
    ['t bar row', 'Remada T-Bar'],
    ['seated row', 'Remada Sentada'],
    ['leg press', 'Leg Press'],
    ['leg extension', 'Cadeira Extensora'],
    ['leg curl', 'Mesa Flexora'],
    ['calf raise', 'Elevacao de Panturrilha'],
    ['triceps pushdown', 'Extensao de Triceps'],
    ['one arm', 'Unilateral'],
    ['seated', 'Sentado'],
    ['standing', 'Em Pe'],
    ['lying', 'Deitado'],
    ['incline', 'Inclinado'],
    ['decline', 'Declinado'],
  ];
  let hit = false;
  for (const [en, pt] of phrases.sort((a, b) => b[0].length - a[0].length)) {
    if (out.includes(en)) {
      out = out.replace(en, ` ${pt.toLowerCase()} `);
      hit = true;
    }
  }
  if (!hit) return null;
  out = out
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  if (eqLabel && !new RegExp(`\\(${eqLabel}\\)$`, 'i').test(out)) out = `${out} (${eqLabel})`;
  return out;
}

function collectAliases(row, extra = []) {
  const out = new Set([...(row.aliases || []), ...extra]);
  for (const v of [row.name, row.name_en, row.name_pt]) {
    if (v && String(v).trim()) out.add(String(v).trim());
  }
  return [...out];
}

function remapSql(fromId, toId) {
  return [
    `update public.sets set exercise_id = ${esc(toId)}::uuid where exercise_id = ${esc(fromId)}::uuid;`,
    `update public.workout_exercises set exercise_id = ${esc(toId)}::uuid where exercise_id = ${esc(fromId)}::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = ${esc(toId)}::uuid and o.id <> workout_exercises.id
      );`,
    `delete from public.workout_exercises where exercise_id = ${esc(fromId)}::uuid;`,
    `update public.template_exercises set exercise_id = ${esc(toId)}::uuid where exercise_id = ${esc(fromId)}::uuid;`,
    `update public.routine_exercises set exercise_id = ${esc(toId)}::uuid where exercise_id = ${esc(fromId)}::uuid;`,
    `delete from public.exercises where id = ${esc(fromId)}::uuid;`,
  ].join('\n');
}

function loadCatalogFromDb() {
  const tmpSql = join(OUT_DIR, '_catalog_query.sql');
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    tmpSql,
    `select id, name, name_en, name_pt, muscle_group, muscle_en, muscle_pt, equipment, image_url, coalesce(aliases, '{}') as aliases
     from public.exercises where is_custom = false order by name_en nulls last, name;\n`,
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

function pickSeatedStandingTarget(variants) {
  const score = (r) => {
    const n = normalize(`${r.name_en} ${r.name_pt}`);
    if (/\bseated\b|\bsentad/.test(n)) return 30;
    if (/\bstanding\b|\bem pe\b/.test(n)) return 20;
    return 5;
  };
  return [...variants].sort((a, b) => score(b) - score(a))[0];
}

function bestCanonical(promote, catalog) {
  const pLabel = `${promote.name_en || ''} ${promote.name_pt || ''}`;
  const pTok = movementTokens(pLabel);
  let best = null;
  let bestScore = 0;
  for (const c of catalog) {
    if (c.id === promote.id) continue;
    if ((promote.equipment || '') !== (c.equipment || '')) continue;
    const cLabel = `${c.name_en || ''} ${c.name_pt || ''}`;
    if (!modifiersCompatible(pLabel, cLabel)) continue;
    let score = jaccard(pTok, movementTokens(cLabel));
    if (normalize(c.name_pt) === normalize(promote.name_pt)) score += 0.6;
    if (normalize(c.name_en) === normalize(promote.name_en)) score += 0.6;
    if (promote.image_url && c.image_url && promote.image_url === c.image_url) score += 0.15;
    if (!c._hevyPromote) score += 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return { best, bestScore };
}

function main() {
  const apply = process.argv.includes('--apply');
  const mig = join(ROOT, 'supabase', 'migrations', '20260730180000_exercise_aliases.sql');
  spawnSync('npx', ['supabase', 'db', 'query', '--linked', '-f', mig], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });

  const catalog = loadCatalogFromDb();
  const promotePreview = existsSync(PROMOTE_PREVIEW)
    ? JSON.parse(readFileSync(PROMOTE_PREVIEW, 'utf8'))
    : { rows: [] };
  const promoteIds = new Set((promotePreview.rows || []).map((r) => r.id));
  for (const row of catalog) row._hevyPromote = promoteIds.has(row.id);

  const byId = new Map(catalog.map((r) => [r.id, r]));
  const merges = [];
  const absorbed = new Set();

  // 1) seated/standing: absorb bare generics in same movement+equipment cluster
  const clusters = new Map();
  for (const row of catalog) {
    const key = clusterKeySeatedStanding(row);
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(row);
  }
  for (const [key, rows] of clusters) {
    if (rows.length < 2) continue;
    const variants = rows.filter((r) => isSeatedOrStanding(r.name_en || r.name_pt || ''));
    const generics = rows.filter((r) => isBareGeneric(r.name_en || r.name_pt || ''));
    if (!variants.length || !generics.length) continue;
    const target = pickSeatedStandingTarget(variants);
    for (const g of generics) {
      // Don't absorb incline/decline/one-arm/etc "generics" that still have hard mods —
      // isBareGeneric only checks seated/standing, so incline flat is "bare" for this rule
      // ONLY if cluster key already isolates incline. Safe.
      if (absorbed.has(g.id)) continue;
      // Prefer not to delete a FED row into a Hevy-only promote if FED seated exists
      merges.push({
        from: g.id,
        to: target.id,
        reason: `generic→seated/standing (${key})`,
        aliases: collectAliases(g),
      });
      absorbed.add(g.id);
      target.aliases = collectAliases(target, collectAliases(g));
    }
  }

  // 2) Merge Hevy promotes into strict canonical matches
  for (const row of catalog) {
    if (!row._hevyPromote || absorbed.has(row.id)) continue;
    const pool = catalog.filter((c) => !absorbed.has(c.id) && c.id !== row.id);
    const { best, bestScore } = bestCanonical(row, pool);
    // Strict: need strong overlap (exact name boost or high jaccard)
    if (!best || bestScore < 0.9) continue;
    // Prefer keep FED (non-promote) as target; if best is also promote, still ok
    let to = best;
    let from = row;
    if (best._hevyPromote && !row._hevyPromote) {
      to = row;
      from = best;
    }
    // If promote is more specific (seated) and target is bare, flip: keep seated row, absorb bare
    const fromLabel = `${from.name_en} ${from.name_pt}`;
    const toLabel = `${to.name_en} ${to.name_pt}`;
    if (isSeatedOrStanding(fromLabel) && isBareGeneric(toLabel) && !isSeatedOrStanding(toLabel)) {
      const tmp = from;
      from = to;
      to = tmp;
    }
    if (absorbed.has(from.id) || from.id === to.id) continue;
    // Avoid no-op / duplicate from lines
    if (merges.some((m) => m.from === from.id)) continue;
    merges.push({
      from: from.id,
      to: to.id,
      reason: `hevy-promote score=${bestScore.toFixed(2)}`,
      aliases: collectAliases(from),
    });
    absorbed.add(from.id);
    to.aliases = collectAliases(to, collectAliases(from));
    if (from.name_pt && looksPortuguese(from.name_pt) && (!to.name_pt || !looksPortuguese(to.name_pt))) {
      to.name_pt = from.name_pt;
      to._ptUpdated = true;
    }
  }

  // 3) i18n fixes on survivors
  const i18nUpdates = [];
  for (const row of catalog) {
    if (absorbed.has(row.id)) continue;
    let nameEn = row.name_en || row.name;
    let namePt = row.name_pt || row.name;
    let changed = !!row._ptUpdated;
    if (row._ptUpdated) namePt = row.name_pt;

    if (nameEn && looksPortuguese(nameEn) && !/\b(press|curl|raise|row|squat|bench|extension|fly|crunch)\b/i.test(nameEn)) {
      // name_en is basically PT — keep as name_pt if needed, leave EN as-is only if we can't fix
      if (!looksPortuguese(namePt) || namePt === nameEn) {
        /* keep */
      }
    }

    if (namePt && /\b(one arm|seated|standing|lying|incline|decline|with|grip|medium)\b/i.test(namePt)) {
      const rebuilt = ptFromEn(nameEn, row.equipment);
      if (rebuilt) {
        namePt = rebuilt;
        changed = true;
      }
    }

    const aliases = [...new Set((row.aliases || []).filter((a) => {
      const n = normalize(a);
      return n && n !== normalize(nameEn) && n !== normalize(namePt);
    }))];

    if (changed || aliases.length) {
      i18nUpdates.push({ id: row.id, name: nameEn, name_en: nameEn, name_pt: namePt, aliases });
    }
  }

  const lines = [
    '-- Deduplicate catalogue + aliases (#112) — strict seated/standing only',
    'begin;',
    `alter table public.exercises add column if not exists aliases text[] not null default '{}';`,
  ];

  const targetAliases = new Map();
  for (const m of merges) {
    if (!targetAliases.has(m.to)) targetAliases.set(m.to, new Set());
    for (const a of m.aliases || []) targetAliases.get(m.to).add(a);
  }
  for (const u of i18nUpdates) {
    if (!targetAliases.has(u.id)) targetAliases.set(u.id, new Set(u.aliases || []));
    else for (const a of u.aliases || []) targetAliases.get(u.id).add(a);
  }

  for (const u of i18nUpdates) {
    const aliasSet = targetAliases.get(u.id) || new Set();
    const cleaned = [...aliasSet].filter(
      (a) => normalize(a) !== normalize(u.name_en) && normalize(a) !== normalize(u.name_pt)
    );
    lines.push(
      `update public.exercises set name = ${esc(u.name)}, name_en = ${esc(u.name_en)}, name_pt = ${esc(u.name_pt)}, aliases = ${escArray(cleaned)} where id = ${esc(u.id)}::uuid;`
    );
  }

  for (const [toId, aliasSet] of targetAliases) {
    if (i18nUpdates.some((u) => u.id === toId)) continue;
    const row = byId.get(toId);
    if (!row) continue;
    const merged = collectAliases(row, [...aliasSet]).filter(
      (a) => normalize(a) !== normalize(row.name_en) && normalize(a) !== normalize(row.name_pt)
    );
    lines.push(`update public.exercises set aliases = ${escArray(merged)} where id = ${esc(toId)}::uuid;`);
  }

  for (const m of merges) {
    lines.push(`-- ${m.reason}`);
    lines.push(remapSql(m.from, m.to));
  }
  lines.push('commit;');

  mkdirSync(dirname(OUT_SQL), { recursive: true });
  writeFileSync(OUT_SQL, lines.join('\n'), 'utf8');
  writeFileSync(
    OUT_REPORT,
    JSON.stringify(
      {
        catalogBefore: catalog.length,
        mergeCount: merges.length,
        merges: merges.map((m) => ({
          from: byId.get(m.from)?.name_en,
          to: byId.get(m.to)?.name_en,
          reason: m.reason,
        })),
        i18nUpdates: i18nUpdates.length,
        keptPromotes: catalog
          .filter((r) => r._hevyPromote && !absorbed.has(r.id))
          .map((r) => ({ name_en: r.name_en, name_pt: r.name_pt })),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Merges: ${merges.length}`);
  console.log(`i18n/alias updates: ${i18nUpdates.length}`);
  console.log(
    `Kept Hevy gaps: ${catalog.filter((r) => r._hevyPromote && !absorbed.has(r.id)).length}`
  );
  console.log(`Wrote ${OUT_SQL}`);

  const shoulder = merges.find(
    (m) =>
      /^(shoulder press \(dumbbell\))$/i.test(byId.get(m.from)?.name_en || '') &&
      /seated shoulder press \(dumbbell\)/i.test(byId.get(m.to)?.name_en || '')
  );
  console.assert(shoulder, 'expected Shoulder Press (Dumbbell) → Seated Shoulder Press (Dumbbell)');

  const badBench = merges.find(
    (m) =>
      /bench press/i.test(byId.get(m.from)?.name_en || '') &&
      /decline|incline/i.test(byId.get(m.to)?.name_en || '') &&
      !/decline|incline/i.test(byId.get(m.from)?.name_en || '')
  );
  console.assert(!badBench, 'must not merge flat bench into incline/decline');

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
