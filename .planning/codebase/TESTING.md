# TESTING

## Scope

Current testing posture and validation workflows for `C:\LyftTrack`.

## Current State

- No dedicated automated test suite files were found (`*.test.*` / `*.spec.*` absent).
- No configured Jest/Vitest/Playwright scripts are present in workspace package scripts.
- Quality is currently enforced mostly through static checks and manual runtime verification.

## Available Quality Gates

### Static Type Validation

- Mobile package: `npx tsc --noEmit` from `app/`.
- Website package: `npm run build --workspace=site` (includes type/build checks).
- Type contracts rely heavily on `app/src/types/database.ts` for Supabase compatibility.

### Linting

- Mobile lint command: `npm run lint --workspace=app`.
- Site lint command: `npm run lint --workspace=site`.
- Root workspace has no single combined lint script at the time of mapping.

### Manual Regression Paths (Observed)

- Auth and navigation:
  - Startup redirect between `/(auth)` and `/(tabs)` in `app/app/_layout.tsx`.
- Workout lifecycle:
  - Active workout flow in `app/app/workout/active.tsx`.
  - Save path in `app/src/services/sessionRepository.ts`.
- Weight logging:
  - Onboarding flow in `app/app/(auth)/onboarding.tsx`.
  - Profile quick log flow in `app/app/(tabs)/profile.tsx`.
- Stats/chart rendering:
  - `app/app/(tabs)/stats.tsx`
  - live exercise modal chart in `app/app/workout/active.tsx`

## Testability Surface

- Good candidates for unit testing:
  - `app/src/utils/inputValidation.ts`
  - `app/src/utils/dateUtils.ts`
  - chart formatting helpers in route modules (after extraction)
- Good candidates for service-level tests with mocked Supabase:
  - `app/src/services/measurementService.ts`
  - `app/src/services/statsService.ts`
  - `app/src/services/sessionRepository.ts`

## Current Risks From Missing Tests

- Regressions can pass CI if they compile but break runtime behavior.
- Input validation drift between UI and service layers can reappear.
- Chart visual regressions (clipping/stretching/formatting) are difficult to catch without visual/e2e checks.
- Schema drift fallbacks may silently degrade behavior if untested.

## Practical Baseline Until Test Suite Exists

- Before merging feature fixes:
  - run `npx tsc --noEmit` in `app/`
  - run `npm run lint --workspace=app`
  - run relevant manual flow checks in Expo app and web shell
- For website changes:
  - run `npm run lint --workspace=site`
  - run `npm run build --workspace=site`

## Recommended Next Steps (Backlog)

- Add minimal unit tests for input/format helpers.
- Add service tests for weight write/read and chart data aggregations.
- Add one e2e smoke path for onboarding -> weight log -> stats display.
- Add CI commands to run static checks for both workspaces in one pipeline.
