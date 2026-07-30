# Progression chart Hevy parity Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax.

**Goal:** Finish PR #101 review ask — sticky pointer, heaviest/1RM(+RIR) metrics, 3m/1y range, hollow active-workout point.

**Architecture:** Extend `statsService.getExerciseProgress` (rir, set_type, e1rm metric, optional since-date). Exercise detail screen owns range UI, sticky `persistPointer`, and merges one live hollow point from `WorkoutContext`.

**Tech Stack:** Expo RN, gifted-charts, Supabase sets query, i18n resources.

## Global Constraints

- Author: KennedySilva8907 only — no AI co-author trailers
- All work on `feat/issue-23-progression-chart` / PR #101
- Spec: `docs/superpowers/specs/2026-07-29-progression-chart-hevy-parity-design.md`
- Do not touch unrelated untracked import work

---

### Task 1: e1rm helper + progress aggregation

**Files:** `app/src/utils/estimateOneRepMax.ts` (new), `app/src/services/statsService.ts`, optionally wire `personalRecords.ts` later

- [ ] Add `estimateOneRepMax(weight, reps, rir?)` — Epley with `reps + rir` when rir finite
- [ ] Extend set fetch: `rir`, `set_type`; skip warmups for chart aggregates
- [ ] Add metric `'e1rm'`; keep existing metrics for other callers
- [ ] `getExerciseProgress(id, metric, locale?, options?: { sinceDate?: string })` filter by date
- [ ] Track `maxWeightReps` / best e1rm set fields as today

### Task 2: Exercise detail UI

**Files:** `app/app/exercise/[id].tsx`, `app/src/i18n/resources.ts`

- [ ] Toggles: heaviest + e1rm only; default weight
- [ ] Range toggle 3m / 1y (default 3m); pass sinceDate into load
- [ ] `persistPointer: true`, `initialPointerIndex` on last finished point
- [ ] Derive active hollow point from WorkoutContext; one today point
- [ ] Pointer card per spec; hollow data point styling
- [ ] i18n EN/PT

### Task 3: Ship

- [ ] Manual sanity on web if possible
- [ ] Commit (human message, no AI trailers) + push branch
- [ ] Reply on PR #101 in PT, human tone
