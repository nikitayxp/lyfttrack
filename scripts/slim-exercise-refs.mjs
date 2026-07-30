import fs from 'node:fs';

const files = [
  'app/src/services/workoutService.ts',
  'app/src/services/statsService.ts',
  'app/src/services/templateService.ts',
  'app/src/services/offlineSyncService.ts',
  'app/src/hooks/useActiveWorkoutState.ts',
  'app/src/utils/exerciseSearch.ts',
  'app/src/utils/exerciseImage.ts',
  'app/src/components/common/ExerciseThumbnail.tsx',
  'app/app/exercise/[id].tsx',
  'app/app/workout/[id].tsx',
  'app/app/workout/active.tsx',
  'app/app/workout/edit/[id].tsx',
  'app/app/(tabs)/workout.tsx',
  'app/app/(tabs)/exercises.tsx',
  'app/app/(tabs)/routines.tsx',
];

const pairs = [
  ['name, name_en, name_pt, muscle_group, muscle_en, muscle_pt', 'name, name_pt, muscle_group'],
  [
    'name, name_en, name_pt, muscle_group, equipment, is_custom, image_url',
    'name, name_pt, muscle_group, equipment, is_custom, image_url',
  ],
  [
    'id, name, name_en, name_pt, muscle_group, equipment, is_custom, image_url',
    'id, name, name_pt, muscle_group, equipment, is_custom, image_url',
  ],
  [
    'exercises(id, name, name_en, name_pt, muscle_group, equipment, is_custom, image_url)',
    'exercises(id, name, name_pt, muscle_group, equipment, is_custom, image_url)',
  ],
  ['exercises(id, name, name_en, name_pt)', 'exercises(id, name, name_pt)'],
  ['exercises(name, name_en, name_pt, muscle_group)', 'exercises(name, name_pt, muscle_group)'],
  ['exercises(name, name_en, name_pt)', 'exercises(name, name_pt)'],
  ['exercises!inner(id, name, name_en, name_pt)', 'exercises!inner(id, name, name_pt)'],
  [
    'exercises(name, name_en, name_pt, muscle_group, muscle_en, muscle_pt)',
    'exercises(name, name_pt, muscle_group)',
  ],
  [
    "'id' | 'name' | 'name_en' | 'name_pt' | 'muscle_group' | 'equipment' | 'is_custom' | 'image_url'",
    "'id' | 'name' | 'name_pt' | 'muscle_group' | 'equipment' | 'is_custom' | 'image_url'",
  ],
  ["'id' | 'name' | 'name_en' | 'name_pt'", "'id' | 'name' | 'name_pt'"],
  [
    "'name' | 'name_en' | 'name_pt' | 'muscle_group' | 'muscle_en' | 'muscle_pt'",
    "'name' | 'name_pt' | 'muscle_group'",
  ],
  ["'name' | 'name_en' | 'name_pt'", "'name' | 'name_pt'"],
  ["Pick<ExerciseRow, 'name' | 'name_en' | 'name_pt'>", "Pick<ExerciseRow, 'name' | 'name_pt'>"],
  [
    "Pick<Tables<'exercises'>, 'name' | 'name_en' | 'name_pt' | 'image_url'>",
    "Pick<Tables<'exercises'>, 'name' | 'name_pt' | 'image_url'>",
  ],
  [
    "Pick<Tables<'exercises'>, 'id' | 'name' | 'name_en' | 'name_pt'>",
    "Pick<Tables<'exercises'>, 'id' | 'name' | 'name_pt'>",
  ],
  [
    "Pick<ExerciseCatalogItem, 'id' | 'name' | 'name_en' | 'name_pt'>",
    "Pick<ExerciseCatalogItem, 'id' | 'name' | 'name_pt'>",
  ],
];

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  let n = 0;
  for (const [a, b] of pairs) {
    if (s.includes(a)) {
      s = s.split(a).join(b);
      n += 1;
    }
  }
  fs.writeFileSync(f, s);
  console.log(f, n);
}
