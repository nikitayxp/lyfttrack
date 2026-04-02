# CONCERNS

## Scope

Mapped technical debt, fragility areas, and risk hotspots as of 2026-04-02.

## Severity Guide

- High: likely user-facing breakage or data trust issue.
- Medium: maintainability/performance issues with moderate operational impact.
- Low: polish/documentation gaps that still reduce delivery speed.

## High Concerns

### 1) Critical reliability fixes are in-progress and central to milestone

- Files:
  - `app/app/(auth)/onboarding.tsx`
  - `app/app/(tabs)/profile.tsx`
  - `app/src/services/measurementService.ts`
  - `app/app/(tabs)/stats.tsx`
  - `app/app/workout/active.tsx`
- Risk:
  - body-weight write path and chart rendering fidelity are active known defects in planning docs (`.planning/REQUIREMENTS.md`).
- Why it matters:
  - directly impacts progress trust and core product value.

### 2) No automated tests for core workout and metrics flows

- No test files are currently present.
- Complex service and UI logic can regress without detection.
- Runtime-only verification is expensive and inconsistent.

### 3) Supabase schema drift risk in fast-moving service layer

- Current code already includes fallback branches for missing columns/tables:
  - `body_measurements.measured_at`
  - `workout_exercises` and `sets.workout_exercise_id`
- Indicates environment/schema mismatch has happened before and can happen again.

## Medium Concerns

### 4) Large high-churn files increase bug surface

- `app/app/workout/active.tsx` is large and includes UI, async orchestration, and chart logic.
- `app/app/(tabs)/profile.tsx` combines profile/social/weight/share concerns.
- `app/src/services/workoutService.ts` centralizes many unrelated service paths.

### 5) Generic root documentation does not describe actual monorepo workflow

- Root `README.md` is generic template text and does not reflect Expo + Next workspace commands.
- New contributors can run wrong commands or miss workspace-specific checks.

### 6) Partial i18n adoption in mobile route files

- i18next is configured, but some screens still include hardcoded literal text.
- This creates translation inconsistency and complicates localization QA.

## Low Concerns

### 7) Duplicate visual constants/helpers across charting surfaces

- Similar compact axis formatting logic exists in both:
  - `app/app/(tabs)/stats.tsx`
  - `app/app/workout/active.tsx`
- Drift between implementations can produce inconsistent labels.

### 8) Monorepo lacks unified root quality scripts

- Root scripts focus on dev entrypoints only.
- No root-level `lint`/`typecheck` script to enforce full workspace quality in one command.

## Suggested Mitigations

- Complete milestone v1.0 phase work for weight + chart reliability first.
- Add lightweight automated coverage for validation and chart formatting helpers.
- Incrementally split large route/service files by feature slice.
- Introduce root quality scripts for app + site (`lint`, `typecheck`).
- Keep repository memory updated when schema drift or chart regressions are fixed.

## Tracking References

- Planning requirements: `.planning/REQUIREMENTS.md`
- Milestone roadmap: `.planning/ROADMAP.md`
- State snapshot: `.planning/STATE.md`
