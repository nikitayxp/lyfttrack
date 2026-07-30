/**
 * Rebuild broken name_pt from name_en for the public catalogue (#112).
 * Multi-pass EN→PT (the FED seed translator only replaced one phrase).
 *
 * Keeps name_pt when it already looks clean Portuguese (no EN leftovers).
 * Hevy import titles stay in aliases.
 *
 * Usage:
 *   node scripts/fix-all-name-pt-112.mjs
 *   node scripts/fix-all-name-pt-112.mjs --apply
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'tmp');
const OUT_SQL = join(ROOT, 'supabase', 'seeds', 'hevy_fix_all_name_pt_112.sql');
const OUT_JSON = join(OUT_DIR, 'name-pt-fix-report.json');

const EQUIPMENT_LABEL_PT = {
  barbell: 'Barra',
  dumbbell: 'Halter',
  machine: 'Maquina',
  cable: 'Polia',
  bodyweight: 'Peso corporal',
  kettlebell: 'Kettlebell',
};

/** Longest-first phrase map. Applied repeatedly until stable. */
const PHRASES = [
  ['alternate bicep curl', 'rosca de biceps alternada'],
  ['alternate heel touchers', 'toque de calcanhares alternado'],
  ['alternating deltoid raise', 'elevacao de deltoide alternada'],
  ['alternating floor press', 'press no chao alternado'],
  ['alternating hang clean', 'hang clean alternado'],
  ['alternating press', 'press alternado'],
  ['alternating renegade row', 'remada renegade alternada'],
  ['alternating row', 'remada alternada'],
  ['alternating shoulder press', 'desenvolvimento alternado'],
  ['bent over low pulley side lateral', 'elevacao lateral na polia baixa curvado'],
  ['bent over one arm long bar row', 'remada unilateral com barra longa curvado'],
  ['bent over rear delt raise with head on bench', 'elevacao posterior curvado com cabeca no banco'],
  ['bent over two arm long bar row', 'remada a dois bracos com barra longa curvado'],
  ['bent over two row with palms in', 'remada curvada pegada neutra'],
  ['bent over two row', 'remada curvada a dois bracos'],
  ['bosu ball crunch with side bends', 'abdominal no bosu com inclinacao lateral'],
  ['box squat with chains', 'agachamento no box com correntes'],
  ['calf raise on a', 'elevacao de panturrilha'],
  ['close grip front lat pulldown', 'puxada alta frontal pegada fechada'],
  ['heel touchers', 'toque de calcanhares'],
  ['deltoid raise', 'elevacao de deltoide'],
  ['floor press', 'press no chao'],
  ['hang clean', 'hang clean'],
  ['long bar', 'barra longa'],
  ['low pulley', 'polia baixa'],
  ['palms in', 'pegada neutra'],
  ['side bends', 'inclinacao lateral'],
  ['head on bench', 'cabeca no banco'],
  ['bicep curl', 'rosca de biceps'],
  ['bicep', 'biceps'],
  ['deltoid', 'deltoide'],
  ['pulley', 'polia'],
  ['floor', 'chao'],
  ['hang', 'hang'],
  ['box', 'box'],
  ['bosu ball', 'bosu'],
  ['bosu', 'bosu'],
  ['wide stance squat', 'agachamento base aberta'],
  ['wide stance', 'base aberta'],
  ['v bar pulldown', 'puxada com barra v'],
  ['v bar', 'barra v'],
  ['triceps pushdown v bar attachment', 'extensao de triceps com barra v'],
  ['seated triceps press', 'press de triceps sentado'],
  ['seated two arm palms up low pulley wrist curl', 'rosca de punho na polia baixa sentado'],
  ['seated press', 'press sentado'],
  ['shoulder military press', 'desenvolvimento militar'],
  ['military press', 'desenvolvimento militar'],
  ['single raise', 'elevacao unilateral'],
  ['smith decline press', 'press declinado no smith'],
  ['smith hip raise', 'elevacao de anca no smith'],
  ['smith incline shoulder raise', 'elevacao de ombros inclinada no smith'],
  ['squat to a bench', 'agachamento ate ao banco'],
  ['squat with plate movers', 'agachamento com discos'],
  ['standing front raise over head', 'elevacao frontal acima da cabeca em pe'],
  ['standing one arm curl over incline bench', 'rosca unilateral no banco inclinado em pe'],
  ['standing palm in one arm press', 'press unilateral pegada neutra em pe'],
  ['standing palms in press', 'press pegada neutra em pe'],
  ['standing palms up behind the back wrist curl', 'rosca de punho atras das costas em pe'],
  ['standing straight arm front delt raise above head', 'elevacao frontal de deltoide acima da cabeca em pe'],
  ['straight raise on incline bench', 'elevacao no banco inclinado'],
  ['45 degree leg press', 'leg press 45'],
  ['bench dips', 'mergulho no banco'],
  ['ab roller', 'ab wheel'],
  ['ab rollout on knees', 'ab wheel de joelhos'],
  ['ab rollout', 'ab wheel'],
  ['sit up', 'abdominal'],
  ['sit-up', 'abdominal'],
  ['around the worlds', 'circumducao de ombros'],
  ['anti gravity press', 'press antigravidade'],
  ['bent arm pullover', 'pullover bracos fletidos'],
  ['bent knee hip raise', 'elevacao de anca joelhos fletidos'],
  ['close grip press', 'press pegada fechada'],
  ['close grip push up off of a', 'flexao pegada fechada'],
  ['crunch legs on exercise ball', 'abdominal com pernas na bola'],
  ['curl lying against an incline', 'rosca deitado no inclinado'],
  ['lying close grip bar curl on high pulley', 'rosca deitado pegada fechada na polia alta'],
  ['lying close grip triceps extension behind the head', 'extensao de triceps deitado pegada fechada atras da cabeca'],
  ['lying close grip triceps press to chin', 'press de triceps deitado pegada fechada ao queixo'],
  ['one arm military press to the side', 'desenvolvimento militar unilateral para o lado'],
  ['palms down wrist curl over a bench', 'rosca de punho pegada pronada no banco'],
  ['palms up wrist curl over a bench', 'rosca de punho pegada supinada no banco'],
  ['seated one arm palms down wrist curl', 'rosca de punho unilateral pegada pronada sentado'],
  ['seated palms down wrist curl', 'rosca de punho pegada pronada sentado'],
  ['reverse grip triceps pushdown', 'extensao de triceps pegada invertida'],
  ['palms down', 'pegada pronada'],
  ['against an incline', 'no inclinado'],
  ['behind the head', 'atras da cabeca'],
  ['to the side', 'para o lado'],
  ['to chin', 'ao queixo'],
  ['exercise ball', 'bola'],
  ['high pulley', 'polia alta'],
  ['off of a', ''],
  ['legs on', 'com pernas na'],
  ['preacher hammer curl', 'rosca scott martelo'],
  ['one arm preacher curl', 'rosca scott unilateral'],
  ['two arm preacher curl', 'rosca scott a dois bracos'],
  ['reverse preacher curl', 'rosca scott invertida'],
  ['zottman preacher curl', 'rosca scott zottman'],
  ['preacher curl', 'rosca scott'],
  ['alternate hammer curl', 'rosca martelo alternada'],
  ['incline hammer curl', 'rosca martelo inclinada'],
  ['hammer curl', 'rosca martelo'],
  ['concentration curl', 'rosca concentrada'],
  ['incline curl', 'rosca inclinada'],
  ['zottman curl', 'rosca zottman'],
  ['reverse curl', 'rosca invertida'],
  ['wrist curl', 'rosca de punho'],
  ['close grip standing curl', 'rosca pegada fechada em pe'],
  ['close grip curl', 'rosca pegada fechada'],
  ['wide grip standing curl', 'rosca pegada aberta em pe'],
  ['standing reverse curl', 'rosca invertida em pe'],
  ['standing concentration curl', 'rosca concentrada em pe'],
  ['one arm shoulder press', 'desenvolvimento unilateral'],
  ['seated shoulder press', 'desenvolvimento sentado'],
  ['shoulder press', 'desenvolvimento'],
  ['military press', 'desenvolvimento militar'],
  ['overhead press', 'desenvolvimento'],
  ['arnold press', 'arnold press'],
  ['jm press', 'press jm'],
  ['side lateral raise', 'elevacao lateral'],
  ['seated side lateral raise', 'elevacao lateral sentada'],
  ['seated lateral raise', 'elevacao lateral sentada'],
  ['lateral raise', 'elevacao lateral'],
  ['front raise', 'elevacao frontal'],
  ['rear delt raise', 'elevacao posterior'],
  ['calf raise', 'elevacao de panturrilha'],
  ['donkey calf raise', 'elevacao de panturrilha'],
  ['hip thrust', 'elevacao pelvica'],
  ['glute bridge', 'ponte de gluteo'],
  ['glute kickback', 'coice de gluteo'],
  ['close grip bench press', 'supino pegada fechada'],
  ['wide grip decline bench press', 'supino declinado pegada aberta'],
  ['wide grip bench press', 'supino pegada aberta'],
  ['incline bench press', 'supino inclinado'],
  ['decline bench press', 'supino declinado'],
  ['bench press', 'supino'],
  ['chest press', 'press de peito'],
  ['smith incline bench press', 'supino inclinado no smith'],
  ['smith bench press', 'supino no smith'],
  ['smith close grip bench press', 'supino pegada fechada no smith'],
  ['guillotine bench press', 'supino guilhotina'],
  ['one arm bench press', 'supino unilateral'],
  ['lying t bar row', 'remada t-bar deitada'],
  ['t bar row with handle', 'remada t-bar'],
  ['t-bar row', 'remada t-bar'],
  ['t bar row', 'remada t-bar'],
  ['bent over row', 'remada curvada'],
  ['seated cable row', 'remada sentada'],
  ['seated row', 'remada sentada'],
  ['one arm row', 'remada unilateral'],
  ['upright row', 'remada alta'],
  ['renegade row', 'remada renegade'],
  ['straight arm pulldown', 'puxada bracos esticados'],
  ['wide grip lat pulldown', 'puxada alta pegada aberta'],
  ['wide grip pulldown behind the neck', 'puxada atras da nuca pegada aberta'],
  ['lat pulldown', 'puxada alta'],
  ['behind the neck', 'atras da nuca'],
  ['wide grip rear pull up', 'barra fixa pegada aberta'],
  ['pull-up', 'barra fixa'],
  ['pull up', 'barra fixa'],
  ['chin-up', 'barra fixa supinada'],
  ['chin up', 'barra fixa supinada'],
  ['weighted pull up', 'barra fixa com peso'],
  ['romanian deadlift', 'peso morto romeno'],
  ['stiff leg deadlift', 'peso morto pernas rijas'],
  ['stiff-legged deadlift', 'peso morto pernas rijas'],
  ['sumo deadlift', 'peso morto sumo'],
  ['deadlift', 'peso morto'],
  ['back squat', 'agachamento'],
  ['front squat', 'agachamento frontal'],
  ['hack squat', 'agachamento hack'],
  ['split squat', 'agachamento bulgaro'],
  ['pistol squat', 'agachamento pistola'],
  ['one leg squat', 'agachamento unilateral'],
  ['squat', 'agachamento'],
  ['lying leg curl', 'mesa flexora'],
  ['seated leg curl', 'cadeira flexora'],
  ['standing leg curl', 'flexora em pe'],
  ['leg curl', 'mesa flexora'],
  ['leg extension', 'cadeira extensora'],
  ['single-leg leg extension', 'cadeira extensora unilateral'],
  ['single leg leg extension', 'cadeira extensora unilateral'],
  ['leg press', 'leg press'],
  ['thigh adductor', 'cadeira adutora'],
  ['thigh abductor', 'cadeira abdutora'],
  ['triceps pushdown', 'extensao de triceps na polia'],
  ['triceps overhead extension', 'extensao de triceps acima da cabeca'],
  ['overhead triceps extension', 'extensao de triceps acima da cabeca'],
  ['one arm triceps extension', 'extensao de triceps unilateral'],
  ['standing one arm triceps extension', 'extensao de triceps unilateral em pe'],
  ['tricep extension', 'extensao de triceps'],
  ['triceps extension', 'extensao de triceps'],
  ['skull crusher', 'triceps testa'],
  ['lying triceps press', 'triceps testa'],
  ['bench dip', 'mergulho no banco'],
  ['weighted bench dip', 'mergulho no banco com peso'],
  ['dip', 'mergulho'],
  ['cable crunch', 'abdominal na polia'],
  ['seated crunch', 'abdominal sentado'],
  ['rope crunch', 'abdominal com corda'],
  ['decline crunch', 'abdominal declinado'],
  ['ab crunch', 'abdominal'],
  ['crunch', 'abdominal'],
  ['hanging leg raise', 'elevacao de pernas na barra'],
  ['hanging knee raise', 'elevacao de joelhos na barra'],
  ['knee raise', 'elevacao de joelhos'],
  ['reverse hyperextension', 'hiperextensao reversa'],
  ['hyperextension', 'hiperextensao'],
  ['back extension', 'extensao lombar'],
  ['good morning', 'good morning'],
  ['face pull', 'face pull'],
  ['cable crossover', 'crossover'],
  ['butterfly', 'crucifixo no voador'],
  ['pec deck', 'crucifixo no voador'],
  ['reverse fly', 'crucifixo invertido'],
  ['reverse machine fly', 'crucifixo invertido'],
  ['incline fly', 'crucifixo inclinado'],
  ['fly', 'crucifixo'],
  ['flyes', 'crucifixo'],
  ['shrug', 'encolhimento'],
  ['lunge', 'afundo'],
  ['walking lunge', 'afundo caminhando'],
  ['bulgarian', 'bulgaro'],
  ['push-up', 'flexao'],
  ['push up', 'flexao'],
  ['plank', 'prancha'],
  ['pullover', 'pullover'],
  ['wrist rotation', 'rotacao de punho'],
  ['wrist rotations', 'rotacao de punho'],
  ['neck', 'pescoco'],
  ['turkish get up', 'turkish get up'],
  ['turkish get-up', 'turkish get up'],
  ['sumo high pull', 'puxada alta sumo'],
  ['two arm clean', 'clean a dois bracos'],
  ['two arm jerk', 'jerk a dois bracos'],
  ['two arm military press', 'desenvolvimento militar a dois bracos'],
  ['two arm row', 'remada a dois bracos'],
  ['one arm', 'unilateral'],
  ['single leg', 'unilateral'],
  ['single-leg', 'unilateral'],
  ['two arm', 'a dois bracos'],
  ['close grip', 'pegada fechada'],
  ['wide grip', 'pegada aberta'],
  ['neutral grip', 'pegada neutra'],
  ['pronated grip', 'pegada pronada'],
  ['hammer grip', 'pegada martelo'],
  ['medium grip', ''],
  ['with chains', 'com correntes'],
  ['with rope', 'com corda'],
  ['with handle', ''],
  ['with knee raise', 'com elevacao de joelho'],
  ['with straight bar', 'com barra'],
  ['with neutral grip', 'pegada neutra'],
  ['behind the neck', 'atras da nuca'],
  ['powerlifting', 'powerlifting'],
  ['leverage', 'alavanca'],
  ['smith', 'smith'],
  ['seated', 'sentado'],
  ['standing', 'em pe'],
  ['lying', 'deitado'],
  ['incline', 'inclinado'],
  ['decline', 'declinado'],
  ['alternate', 'alternado'],
  ['alternating', 'alternado'],
  ['reverse', 'invertido'],
  ['overhead', 'acima da cabeca'],
  ['flat bench', 'banco plano'],
  ['flat', 'plano'],
  ['bent over', 'curvado'],
  ['bent-over', 'curvado'],
  ['straight arm', 'bracos esticados'],
  ['straight-arm', 'bracos esticados'],
  ['rear', 'posterior'],
  ['front', 'frontal'],
  ['side', 'lateral'],
  ['high', 'alta'],
  ['low', 'baixa'],
  ['step up', 'step up'],
  ['windmill', 'windmill'],
  ['thruster', 'thruster'],
  ['halo', 'halo'],
  ['clean', 'clean'],
  ['jerk', 'jerk'],
  ['row', 'remada'],
  ['curl', 'rosca'],
  ['extension', 'extensao'],
  ['press', 'press'],
  ['raise', 'elevacao'],
  ['pulldown', 'puxada'],
  ['pushdown', 'extensao'],
];

const EN_CRUMBS =
  /\b(one|arm|two|seated|standing|lying|incline|decline|with|grip|medium|wide|close|hammer|reverse|flat|pull|behind|neck|overhead|leverage|smith|alternate|alternating|pronated|supinated|neutral|chains|powerlifting|handle|rope|knee|step|sumo|high|clean|jerk|military|turkish|get|thruster|windmill|wrist|rotations|straight|rear|front|side|delt|bent|over|single|leg|glute|kickback|pushdown|skull|crusher|flyes|flies|pullover|deadlift|bench|shoulder|tricep|bicep|lat|calf|hip|thrust|bridge|crunch|plank|dip|lunge|shrug|hyperextension|pulldown|cable|dumbbell|barbell|machine|bodyweight|kettlebell|up|down|in|on|the|and|of|for|to|from|by)\b/i;

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

function titleCasePt(text) {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'a', 'com', 'para']);
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      if (/^(t-bar|jm|em)$/i.test(w)) return w;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function stripEquipmentParen(name) {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
}

function applyPhrase(out, en, pt) {
  if (!en) return out;
  const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const re = new RegExp(`\\b${escaped}\\b`, 'i');
  return out.replace(re, ` ${pt} `).replace(/\s+/g, ' ').trim();
}

const LEFTOVER_WORDS = [
  ['behind the back', 'atras das costas'],
  ['above head', 'acima da cabeca'],
  ['over head', 'acima da cabeca'],
  ['on incline bench', 'no banco inclinado'],
  ['incline bench', 'banco inclinado'],
  ['to a bench', 'ate ao banco'],
  ['plate movers', 'discos'],
  ['palms up', 'pegada supinada'],
  ['palms in', 'pegada neutra'],
  ['palm in', 'pegada neutra'],
  ['bent arm', 'bracos fletidos'],
  ['bent knee', 'joelhos fletidos'],
  ['wide stance', 'base aberta'],
  ['v bar', 'barra v'],
  ['attachment', ''],
  ['shoulder', 'ombros'],
  ['military', 'militar'],
  ['single', 'unilateral'],
  ['degree', 'graus'],
  ['dips', 'mergulho'],
  ['hip', 'anca'],
  ['delt', 'deltoide'],
  ['bench', 'banco'],
  ['knees', 'joelhos'],
  ['knee', 'joelho'],
  ['plate', 'disco'],
  ['with', 'com'],
];

function translateEnToPtBase(nameEn) {
  let out = normalize(stripEquipmentParen(nameEn));
  // Normalize odd FED punctuation: Shoulder (military) Press
  out = out.replace(/\(\s*/g, ' ').replace(/\s*\)/g, ' ').replace(/\s+/g, ' ').trim();

  const sorted = [...PHRASES].sort((a, b) => b[0].length - a[0].length);
  for (const [en, pt] of sorted) {
    out = applyPhrase(out, en, pt);
  }
  for (const [en, pt] of [...LEFTOVER_WORDS].sort((a, b) => b[0].length - a[0].length)) {
    out = applyPhrase(out, en, pt);
  }
  out = out.replace(/\s+/g, ' ').trim();
  return titleCasePt(out);
}

function withPtEquipment(base, equipment) {
  const label = EQUIPMENT_LABEL_PT[equipment];
  if (!label) return base;
  const cleaned = base.replace(new RegExp(`\\s*\\(${label}\\)\\s*$`, 'i'), '').trim();
  return `${cleaned} (${label})`;
}

function hasEnglishCrumbs(namePt) {
  // Allow known intentional EN loanwords in PT UI
  const cleaned = normalize(namePt)
    .replace(/\b(leg press|face pull|good morning|arnold press|press jm|t bar|smith|kettlebell|powerlifting|crossover|step up|turkish get up|thruster|windmill|halo|clean|jerk|pullover|hack|bosu|ball|box|floor|hang|deltoid|bicep|heel|touchers|palms|long|bar|pulley|head|on|bench|s)\b/g, ' ');
  // Remaining common EN leftovers from half-translations
  return /\b(one|arm|two|seated|standing|lying|incline|decline|with|grip|medium|wide|close|hammer|reverse|flat|pull|behind|neck|overhead|leverage|alternate|alternating|pronated|supinated|neutral|chains|handle|rope|knee|step|sumo|high|military|turkish|get|wrist|rotations|straight|rear|front|side|delt|bent|over|single|leg|glute|kickback|pushdown|skull|crusher|flyes|flies|deadlift|bench|shoulder|tricep|lat|calf|hip|thrust|bridge|crunch|plank|dip|lunge|shrug|hyperextension|pulldown|cable|dumbbell|barbell|machine|bodyweight|up|down|in|the|and|of|for|to|from|by|row|curl|press|raise|extension|squat)\b/i.test(
    cleaned
  );
}

function esc(value) {
  if (value == null) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function loadCatalog() {
  mkdirSync(OUT_DIR, { recursive: true });
  const tmpSql = join(OUT_DIR, '_name_pt_query.sql');
  writeFileSync(
    tmpSql,
    `select id, name_en, name_pt, equipment from public.exercises where is_custom = false order by name_en;\n`,
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

function loadPromotePtByEn() {
  const path = join(ROOT, 'supabase', 'seeds', 'hevy_promote_112.preview.json');
  if (!existsSync(path)) return new Map();
  const preview = JSON.parse(readFileSync(path, 'utf8'));
  const map = new Map();
  for (const r of preview.rows || []) {
    if (r.name_en && r.name_pt && !hasEnglishCrumbs(r.name_pt)) {
      map.set(normalize(r.name_en), cleanHevyPt(r.name_pt));
    }
  }
  return map;
}

function cleanHevyPt(value) {
  return String(value || '')
    .replace(/\\n/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function main() {
  const apply = process.argv.includes('--apply');
  const catalog = loadCatalog();
  const hevyPt = loadPromotePtByEn();
  const updates = [];
  const kept = [];

  for (const row of catalog) {
    const nameEn = row.name_en || '';
    const currentPt = row.name_pt || '';
    if (!nameEn) continue;

    const hevy = hevyPt.get(normalize(nameEn));
    const base = translateEnToPtBase(nameEn);
    const nextPt = hevy || withPtEquipment(base, row.equipment);

    if (!nextPt) continue;
    if (normalize(nextPt) === normalize(currentPt) && !hasEnglishCrumbs(currentPt)) {
      kept.push({ id: row.id, name_en: nameEn, name_pt: currentPt });
      continue;
    }
    updates.push({
      id: row.id,
      name_en: nameEn,
      from: currentPt,
      to: nextPt,
    });
  }

  const lines = ['-- Rebuild broken name_pt from name_en (#112)', 'begin;'];
  for (const u of updates) {
    lines.push(
      `update public.exercises set name_pt = ${esc(u.to)} where id = ${esc(u.id)}::uuid;`
    );
  }
  lines.push('commit;');
  mkdirSync(dirname(OUT_SQL), { recursive: true });
  writeFileSync(OUT_SQL, lines.join('\n'), 'utf8');
  writeFileSync(
    OUT_JSON,
    JSON.stringify({ updated: updates.length, keptClean: kept.length, sample: updates.slice(0, 40) }, null, 2),
    'utf8'
  );

  console.log(`Updated: ${updates.length}`);
  console.log(`Kept clean PT: ${kept.length}`);
  for (const u of updates.slice(0, 25)) {
    console.log(`  ${u.name_en}`);
    console.log(`    - ${u.from}`);
    console.log(`    + ${u.to}`);
  }
  console.log(`Wrote ${OUT_SQL}`);

  // Self-checks
  const oneArm = updates.find((u) => u.name_en === 'One Arm Shoulder Press (Dumbbell)');
  if (oneArm) {
    console.assert(
      /desenvolvimento unilateral/i.test(normalize(oneArm.to)),
      'one arm shoulder → desenvolvimento unilateral'
    );
  }
  const wide = updates.find((u) => u.name_en === 'Wide Grip Bench Press (Barbell)');
  if (wide) {
    console.assert(/supino.*pegada aberta|pegada aberta.*supino/i.test(normalize(wide.to)), 'wide grip bench');
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
