---
mode: quick-full
quick_id: 260402-mbu
description: Fix body weight logging reliability and gifted chart fidelity in onboarding/profile/stats/active with validation
must_haves:
  truths:
    - Body weight validation must be explicit and consistent between UI submit handlers and measurement service writes.
    - Profile body-weight log must provide optimistic UI feedback with rollback on failure.
    - Stats and active-workout charts must use compact axis labels and dynamic top headroom.
    - Validation gate must run locally (typecheck/lint) with recorded outcome.
  artifacts:
    - .planning/quick/260402-mbu-fix-body-weight-logging-reliability-and-/260402-mbu-RESEARCH.md
    - .planning/quick/260402-mbu-fix-body-weight-logging-reliability-and-/260402-mbu-SUMMARY.md
    - .planning/quick/260402-mbu-fix-body-weight-logging-reliability-and-/260402-mbu-VERIFICATION.md
    - .planning/STATE.md
  key_links:
    - app/app/(auth)/onboarding.tsx
    - app/app/(tabs)/profile.tsx
    - app/src/services/measurementService.ts
    - app/app/(tabs)/stats.tsx
    - app/app/workout/active.tsx
---

# Quick Plan 260402-mbu

## Task 1 - Validate bug 1 implementation coverage

files:
- app/app/(auth)/onboarding.tsx
- app/app/(tabs)/profile.tsx
- app/src/services/measurementService.ts

action:
- Map all submit/write points and verify input parsing, max-range checks, and persistence flow.
- Confirm optimistic profile weight update with reconciliation and rollback behavior.

done:
- All 3 files mapped and audited; reliability pattern confirmed.

verify:
- onboarding uses toSafeNumber + BODY_WEIGHT_MAX_KG + addWeight.
- profile save path creates optimistic entry and reconciles with persisted row.
- service throws explicit error on invalid/out-of-range input and does not silently clamp.

## Task 2 - Validate bug 2 chart fidelity coverage

files:
- app/app/(tabs)/stats.tsx
- app/app/workout/active.tsx

action:
- Verify compact axis formatting, top headroom props, width responsiveness, and spacing/color props in gifted charts.

done:
- Both files mapped and audited; chart-fidelity pattern confirmed.

verify:
- formatCompactAxisNumber used for y-axis labels.
- dynamic maxValue uses ~1.25x highest series value.
- adjustToWidth is true and width is based on current window width.
- bar/line spacing includes endSpacing=0 and blue accent color.

## Task 3 - Run local validation and close quick artifacts

files:
- app/*
- .planning/quick/260402-mbu-fix-body-weight-logging-reliability-and-/*
- .planning/STATE.md

action:
- Run lint and TypeScript noEmit checks.
- Record outcomes and verification status.
- Update STATE quick task table and prepare scoped quick-task docs commit.

done:
- Validation commands executed and artifacts generated.

verify:
- no syntax/type errors in targeted bug files.
- tsc noEmit completes successfully.
- lint reports warnings only (no blocking errors).
