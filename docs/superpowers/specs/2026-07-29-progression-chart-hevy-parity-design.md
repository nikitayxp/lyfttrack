# Design: progression chart Hevy parity (PR #101 / #23)

Data: 2026-07-29  
Issue: [#23](https://github.com/nikitayxp/lyfttrack/issues/23)  
PR: [#101](https://github.com/nikitayxp/lyfttrack/pull/101)

Review follow-up on the interactive progression chart: sticky selection, max-weight / 1RM metrics (with RIR), time range, and an in-progress hollow point from the active workout.

## Scope (all in #101)

| # | Behaviour |
|---|-----------|
| 1 | Sticky pointer — finger up keeps the last point’s strip + card |
| 2 | Metrics — only **Maior peso** (default) and **1RM** (remove Volume / Reps toggles) |
| 3 | 1RM uses Epley with effective reps = `reps + rir` when RIR is set; else plain Epley |
| 4 | Time range — default **3 months**, toggle **1 year** |
| 5 | Active workout — hollow / dashed point for today’s in-progress session when this exercise is in the active workout and has completed sets with weight |

Already shipped on the branch (keep): line chart, data-scaled axes, pointer X correction, heaviest-set reps on the card.

Out of scope: changing PR cards below the chart; swapping chart libraries; volume/reps as chart metrics.

## Architecture

Keep `react-native-gifted-charts` `LineChart` on `app/app/exercise/[id].tsx`. Extend `statsService.getExerciseProgress` for metric + date window + RIR-aware 1RM. Derive the active point in the screen from `WorkoutContext` (no persistence).

```
[finished sets via statsService] + [optional active point from WorkoutContext]
        → filtered by range → LineChart data (+ hollow style on active)
        → pointerConfig.persistPointer
```

## Metrics

- `ProgressMetric` for this screen: `'weight' | 'e1rm'` (drop volume/reps from the exercise detail toggles only; other callers of `getExerciseProgress` may keep existing metric keys if still used).
- Default: `'weight'`.
- Y value: heaviest set weight, or max estimated 1RM that day.
- Pointer card: date; weight mode shows `weight × reps`; e1rm mode shows estimated 1RM (and `weight × reps` as secondary). Drop the volume line from the pointer card.

### 1RM + RIR

Shared helper (prefer one place used by progress aggregation):

```
effectiveReps = rir != null && finite ? reps + rir : reps
e1rm = weight * (1 + effectiveReps / 30)   // Epley; 0 if weight/reps invalid
```

Fetch must include `rir` on set rows for progress.

Warmups: exclude from max-weight / e1rm day aggregates. Progress query selects `set_type` and skips `warmup` rows for chart metrics.

## Time range

- State: `'3m' | '1y'`, default `'3m'`.
- Filter points whose `date` is within the window ending today (UTC date keys as today).
- Empty window → existing empty placeholder.
- Changing range resets pointer to latest visible historical point (not the active hollow point unless it is the only point).

## Sticky pointer

- `pointerConfig.persistPointer: true`.
- `initialPointerIndex`: last finished (non-active) point index when data loads; if only the active point exists, that index.
- Keep existing `POINTER_X_CORRECTION` for strip / dot / card.

## Active workout point

Show when:

1. `hasActiveWorkout` and this `exerciseId` is in `activeExercises`, and
2. at least one set with `completed === true` and weight > 0 (and reps > 0 for e1rm).

Value:

- weight mode: max weight among those completed sets (reps of that heaviest set for the card).
- e1rm mode: max RIR-aware e1rm among those sets.

Rendering:

- Append as the last data point (today’s label).
- Hollow / dashed look: unfilled circle (border only) and/or dashed connector into that point if the library allows per-point styling; otherwise hollow `dataPoint` via custom component / transparent fill + stroke.
- Does not rewrite finished history or PR aggregates.

**One today point:** while this exercise is active with a live value, replace any finished aggregate for today’s date with the live active point (hollow). Do not plot two points on the same day.

## i18n

EN/PT keys for: metric “Heaviest” / “Maior peso”, “Est. 1RM” / “1RM est.”, range “3 months” / “3 meses”, “1 year” / “1 ano”, updated progress subtitles, optional “In progress” on the pointer card for the active point.

## Testing

- Web: sticky pointer stays after release; metric toggle changes Y values; range filters points; with a staged active workout containing the exercise and completed sets, hollow point appears and updates when completing another set.
- Confirm pointer still lands on the blue/hollow point (X correction still correct with the extra point).
- No RIR → e1rm matches old Epley; with RIR → higher e1rm as expected (`3@1` ≈ `4@0`).

## Files likely touched

- `app/app/exercise/[id].tsx`
- `app/src/services/statsService.ts`
- `app/src/utils/personalRecords.ts` or a small shared e1rm helper if we unify formulas
- `app/src/i18n/resources.ts`
