/**
 * Remap custom (Hevy-imported) exercises onto catalogue rows via token matching.
 * Writes tmp/remap-customs-from-tokens.sql
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const exercises = JSON.parse(fs.readFileSync(path.join(root, 'tmp', 'all-exercises.json'), 'utf8'));

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
    .replace(/\bhalteres?\b/g, 'dumbbell')
    .replace(/\bmaquina\b/g, 'machine')
    .replace(/\bpolia\b/g, 'cable')
    .replace(/\bcabo\b/g, 'cable')
    .replace(/\bsmith\b/g, 'smith')
    .replace(/\bleg press\b/g, 'legpress')
    .replace(/\bhack\b/g, 'hack');
}

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
  press: 'press',
  terra: 'deadlift',
  deadlift: 'deadlift',
  stiff: 'rdl',
  romeno: 'rdl',
  elevacao: 'raise',
  raise: 'raise',
  crucifixo: 'fly',
  fly: 'fly',
  flyes: 'fly',
  abdominal: 'crunch',
  crunch: 'crunch',
  extensao: 'extension',
  extension: 'extension',
  flexao: 'pushup',
  pushup: 'pushup',
  mergulho: 'dip',
  dip: 'dip',
  cadeira: 'machine',
  mesa: 'machine',
  panturrilha: 'calf',
  calf: 'calf',
  gemeos: 'calf',
  gluteo: 'glute',
  glute: 'glute',
  pelvica: 'hipthrust',
  hip: 'hipthrust',
  thrust: 'hipthrust',
  adutora: 'adductor',
  adductor: 'adductor',
  abdutor: 'abductor',
  abductor: 'abductor',
  voador: 'pecdeck',
  pec: 'pecdeck',
  deck: 'pecdeck',
  hack: 'hack',
  legpress: 'legpress',
  puxada: 'pulldown',
};

const TITLE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'in', 'na', 'nas',
  'no', 'nos', 'of', 'on', 'para', 'the', 'com', 'peso', 'plates', 'placa', 'placas',
]);

function titleTokenKey(value) {
  const normalized = applyEquipmentSynonyms(normalizeTitle(value));
  const tokens = normalized
    .split(' ')
    .filter(Boolean)
    .map((token) => MOVEMENT_TOKEN_CANONICAL[token] ?? token)
    .filter((token) => token.length > 0 && !TITLE_STOP_WORDS.has(token));
  return [...new Set(tokens)].sort().join(' ');
}

function catalogQuality(item) {
  let score = item.is_custom ? 0 : 80;
  if (item.name_en) score += 20;
  if (item.name_pt) score += 20;
  return score;
}

const catalog = exercises.filter((e) => !e.is_custom);
const customs = exercises.filter((e) => e.is_custom);

const exact = new Map();
const byTokens = new Map();

for (const item of catalog) {
  for (const name of [item.name, item.name_en, item.name_pt]) {
    if (!name) continue;
    const exactKey = normalizeTitle(name);
    const currentExact = exact.get(exactKey);
    if (exactKey && (!currentExact || catalogQuality(item) > catalogQuality(currentExact))) {
      exact.set(exactKey, item);
    }
    const tokenKey = titleTokenKey(name);
    const currentToken = byTokens.get(tokenKey);
    if (tokenKey && (!currentToken || catalogQuality(item) > catalogQuality(currentToken))) {
      byTokens.set(tokenKey, item);
    }
  }
}

const remaps = [];
const unmatched = [];

for (const custom of customs) {
  const title = custom.name;
  const exactHit = exact.get(normalizeTitle(title));
  const tokenHit = exactHit ?? byTokens.get(titleTokenKey(title));
  if (tokenHit) {
    remaps.push({
      custom_id: custom.id,
      custom_name: custom.name,
      catalog_id: tokenHit.id,
      catalog_name: tokenHit.name,
      kind: exactHit ? 'exact' : 'alias',
      tokens: titleTokenKey(title),
    });
  } else {
    unmatched.push({ name: custom.name, tokens: titleTokenKey(title) });
  }
}

fs.writeFileSync(
  path.join(root, 'tmp', 'remap-preview.json'),
  JSON.stringify({ remapped: remaps.length, unmatched: unmatched.length, remaps, unmatched }, null, 2)
);

const values = remaps
  .map((r) => `  ('${r.custom_id}'::uuid, '${r.catalog_id}'::uuid)`)
  .join(',\n');

const sql = `-- Token-based custom → catalogue remap (#104)
-- Remapped: ${remaps.length} / Unmatched left as private customs: ${unmatched.length}

begin;

create temporary table custom_remap(custom_id uuid, catalog_id uuid) on commit drop;
insert into custom_remap(custom_id, catalog_id) values
${values};

-- Collapse duplicate workout_exercises that would collide after remap
delete from public.workout_exercises we
using custom_remap r
where we.exercise_id = r.custom_id
  and exists (
    select 1 from public.workout_exercises other
    where other.workout_id = we.workout_id
      and other.exercise_id = r.catalog_id
      and other.id <> we.id
  );

update public.sets s
set exercise_id = r.catalog_id
from custom_remap r
where s.exercise_id = r.custom_id;

update public.workout_exercises we
set exercise_id = r.catalog_id
from custom_remap r
where we.exercise_id = r.custom_id
  and not exists (
    select 1 from public.workout_exercises other
    where other.workout_id = we.workout_id
      and other.exercise_id = r.catalog_id
      and other.id <> we.id
  );

update public.template_exercises te
set exercise_id = r.catalog_id
from custom_remap r
where te.exercise_id = r.custom_id;

update public.routine_exercises re
set exercise_id = r.catalog_id
from custom_remap r
where re.exercise_id = r.custom_id;

delete from public.exercises e
where e.id in (select custom_id from custom_remap)
  and not exists (select 1 from public.sets s where s.exercise_id = e.id)
  and not exists (select 1 from public.workout_exercises we where we.exercise_id = e.id)
  and not exists (select 1 from public.template_exercises te where te.exercise_id = e.id)
  and not exists (select 1 from public.routine_exercises re where re.exercise_id = e.id);

commit;

select
  (select count(*) from public.exercises where not is_custom) as catalog,
  (select count(*) from public.exercises where is_custom) as custom_remaining;
`;

fs.writeFileSync(path.join(root, 'tmp', 'remap-customs-from-tokens.sql'), sql);
console.log(`Remapped ${remaps.length}, unmatched ${unmatched.length}`);
console.log('Sample remaps:', remaps.slice(0, 15).map((r) => `${r.custom_name} → ${r.catalog_name} (${r.kind})`));
console.log('Sample unmatched:', unmatched.slice(0, 15).map((u) => u.name));
