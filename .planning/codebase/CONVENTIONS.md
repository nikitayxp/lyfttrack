# CONVENTIONS

## Scope

Observed coding and implementation conventions across `app/` and `site/`.

## Language and Typing

- TypeScript strict mode is enabled in both workspaces:
  - `app/tsconfig.json`
  - `site/tsconfig.json`
- Mobile app relies on generated Supabase types in `app/src/types/database.ts`.
- Services typically export domain types close to implementation (`type WorkoutFeedItem`, `type ExerciseProgressPoint`, etc.).

## Imports and Path Aliases

- Mobile alias pattern:
  - `@/*` -> `app/src/*`
  - `@assets/*` -> `app/assets/*`
- Website alias pattern:
  - `@/*` -> `site/src/*`
- Relative imports are used sparingly for nearby files; alias imports dominate feature code.

## State and Data Access

- Screens delegate network/database work to `app/src/services/*`.
- Cross-screen state is handled with React context for major domains:
  - `WorkoutContext`
  - `PreferencesContext`
- Pattern favors pragmatic, co-located hooks/services over heavy global store frameworks.

## Validation and Input Hygiene

- Centralized validation helpers exist in `app/src/utils/inputValidation.ts`.
- Common pattern:
  - Sanitize input strings in UI (`sanitizeDecimalText`, `sanitizeIntegerText`).
  - Parse/validate again before persistence (`toSafeNumber`, `toSafeInteger`).
- Service layer commonly re-validates write payloads for zero-trust safety.

## Error Handling Style

- Services throw descriptive `Error` messages with context.
- Screens catch service errors and surface user-facing feedback via:
  - `Alert.alert(...)`
  - inline screen feedback banners
- Known tolerant paths use fallback behavior for schema drift where possible.

## Optimistic UI Patterns

- Existing optimistic update usage in high-interaction surfaces:
  - Weight entry in `app/app/(tabs)/profile.tsx`.
  - Likes/comments in `app/app/(tabs)/profile.tsx`.
- Pattern is generally:
  - create optimistic local object
  - update local state immediately
  - reconcile with persisted response
  - rollback on failure

## Styling and Theming

- Mobile styling uses React Native `StyleSheet.create(...)`.
- Theme constants are centralized in `app/src/constants/Colors.ts` and `app/src/constants/theme.ts`.
- Dark heavy palette is currently reused for both light/dark keys (`Colors.light` and `Colors.dark`).
- Website uses Next.js + CSS/Tailwind-style setup (`site/src/app/globals.css`).

## Charting Conventions (Current)

- `react-native-gifted-charts` is used in:
  - `app/app/(tabs)/stats.tsx`
  - `app/app/workout/active.tsx`
- Existing conventions include:
  - compact formatting helper (`k` and `m`) via `formatCompactAxisNumber(...)`
  - explicit `maxValue` headroom (~1.25x current max)
  - `endSpacing={0}` and `adjustToWidth={true}` in chart components

## i18n and Copy

- Mobile text supports EN/PT through i18next resources in `app/src/i18n/resources.ts`.
- Some route-level copy still appears as inline literal strings, indicating partial i18n adoption.

## File/Function Organization

- Service files are capability-oriented but some are monolithic (`workoutService.ts`).
- Route files can include UI + orchestration + helper formatting in one module.
- Utilities are extracted when reused by multiple features (validation, date, localization).

## Conventions To Preserve

- Keep validation logic aligned between submit handlers and service writes.
- Preserve strict typing against generated DB contracts.
- Keep route files thin where possible by extracting heavy logic into services/hooks.
