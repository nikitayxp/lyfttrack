# STRUCTURE

## Scope

Directory and file organization map for `C:\LyftTrack`.

## Repository Layout

- `package.json` (root workspace config)
- `app/` (Expo mobile app workspace)
- `site/` (Next.js website workspace)
- `.planning/` (GSD project planning artifacts)

## Mobile Workspace Structure (`app/`)

### Entry and Routing

- `app/index.tsx` (Expo entry)
- `app/app/_layout.tsx` (root stack + auth gate)
- `app/app/(auth)/*` (auth + onboarding routes)
- `app/app/(tabs)/*` (main tab routes)
- `app/app/workout/*` (workout subroutes)

### Source Modules (`app/src/`)

- `components/`
  - Feature UI by domain (`auth`, `feed`, `workout`, `common`, `ui`).
- `constants/`
  - Theme, spacing, exercise catalog metadata.
- `context/`
  - App-level contexts (`PreferencesContext`, `WorkoutContext`).
- `hooks/`
  - Reusable state/timing hooks.
- `i18n/`
  - i18next setup + translation resources.
- `services/`
  - Supabase-driven domain services and repositories.
- `types/`
  - Generated DB schema and auxiliary type shims.
- `utils/`
  - Input validation, localization helpers, date/math utilities.

### Mobile Config

- `app/app.json` (Expo app config)
- `app/eas.json` (EAS build profiles)
- `app/eslint.config.js`
- `app/tsconfig.json`

## Website Workspace Structure (`site/`)

### App Router and Pages

- `site/src/app/layout.tsx` (global layout, fonts, toaster, consent)
- `site/src/app/page.tsx` (landing entry)
- `site/src/app/blog/[slug]/page.tsx` (blog article route)
- `site/src/app/globals.css`

### Component and Data Layers

- `site/src/components/home/*` (landing sections)
- `site/src/components/blog/*` (blog rendering)
- `site/src/components/ui/*` (reusable UI pieces)
- `site/src/lib/marketing-data.ts` (landing content/model)
- `site/src/lib/blog-data.ts` (blog content/model)
- `site/src/lib/utils.ts` (general helpers)

### Website Config

- `site/next.config.ts`
- `site/postcss.config.mjs`
- `site/eslint.config.mjs`
- `site/tsconfig.json`
- `site/vercel.json`

## Naming and Placement Patterns

- Route files follow Expo Router/Next App Router conventions (`_layout.tsx`, `[id].tsx`, `[slug]/page.tsx`).
- Mobile route-group naming follows Expo conventions with parentheses:
  - `(auth)` and `(tabs)`.
- Service files are grouped by business capability (`statsService.ts`, `measurementService.ts`).
- Context files use `*Context.tsx` naming and include hook exports (`useWorkoutContext`, `usePreferences`).

## Current Organizational Strengths

- Clear split between app and site concerns.
- Predictable `src` layering in mobile workspace.
- GSD planning artifacts are already in place under `.planning/`.

## Current Structural Friction

- Large feature files in route layer increase coupling and review complexity:
  - `app/app/workout/active.tsx`
  - `app/app/(tabs)/profile.tsx`
- `app/src/services/workoutService.ts` combines many responsibilities (catalog, routines, feed, workout details).
- Root `README.md` currently reflects generic Next.js boilerplate, not monorepo-specific instructions.

## Where To Place Future Changes

- New mobile routes: `app/app/...` by route group.
- Shared mobile UI: `app/src/components/<domain>/`.
- Data reads/writes: `app/src/services/` first, not inside route files.
- Reusable validation/parsing: `app/src/utils/inputValidation.ts` and adjacent utils.
- Website content pages/components: `site/src/app/*` and `site/src/components/*`.
