# Expand exercise catalogue (#104)

## Goal
Gym weightlifting catalogue large enough that Hevy CSV import reuses shared exercises instead of creating customs. No Gym visual media.

## What we did in the linked Supabase project
1. Seeded ~1000 gym-filtered exercises from `hasaneyldrm/exercises-dataset` (**names / muscle / equipment only**, MIT data).
2. Dropped cardio / CrossFit-style cardio toys / bands-medicine-ball clutter for v1.
3. Remapped 53 Hevy customs onto catalogue rows via explicit PT→EN aliases.
4. Promoted remaining unmatched Hevy names into the shared catalogue (still 0 `is_custom`).
5. Result snapshot: **~1128 catalogue rows, 0 customs**.

## Reproduce / refresh
```bash
# needs tmp/exercises-dataset.json (download from the dataset repo data/exercises.json)
node scripts/build-gym-catalog.mjs
npx supabase db query --linked -f tmp/gym-catalog-seed.sql
node scripts/remap-and-promote-customs.mjs
npx supabase db query --linked -f tmp/remap-and-promote.sql
```

## Import follow-up
`app/src/constants/hevyExerciseAliases.ts` holds the Hevy PT → catalogue map. Wire it into `importService.matchExerciseTitles` on the import branch (#68 / PR #103) before the next import test.
