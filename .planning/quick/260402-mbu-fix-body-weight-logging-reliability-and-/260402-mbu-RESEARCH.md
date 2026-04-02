# Quick Task 260402-mbu - Research

## Scope

Task: Fix body weight logging reliability and gifted chart fidelity in onboarding/profile/stats/active with validation.

Date: 2026-04-02
Mode: quick + research + validate(full)

## Files Mapped

- app/app/(auth)/onboarding.tsx
- app/app/(tabs)/profile.tsx
- app/src/services/measurementService.ts
- app/app/(tabs)/stats.tsx
- app/app/workout/active.tsx

## Findings

### Bug 1 - Body weight logging reliability

Current implementation already applies the expected reliability pattern:

- Shared max guard exported as BODY_WEIGHT_MAX_KG from input limits:
  - app/src/services/measurementService.ts
- Service-level validation has no silent clamp and throws explicit errors for invalid/out-of-range input.
- Onboarding submit path:
  - uses toSafeNumber + BODY_WEIGHT_MAX_KG check
  - writes profile fullName then persists weight
  - restores original input on failure
- Profile submit path:
  - parses and validates locally
  - applies optimistic entry immediately to local weight history
  - reconciles with persisted row and refreshes history after write
  - rolls back optimistic state and restores input on failure

Conclusion: Architecture for bug 1 is in place and aligned with the requested technique.

### Bug 2 - Chart fidelity (stats + active modal)

Current implementation already applies the requested chart-fidelity controls:

- Compact Y-axis formatter with k/m scaling:
  - formatCompactAxisNumber in stats and active files
- Top clipping prevention:
  - dynamic maxValue with 1.25x headroom
  - overflowTop used in chart props
- Responsive width strategy:
  - width derived from window width with constrained max
  - adjustToWidth={true}
- Bar chart readability and spacing:
  - frontColor set to CHART_NEON blue
  - barWidth increased
  - endSpacing={0}

Conclusion: Implementation for bug 2 is present and matches requested Hevy-style constraints.

## Risks / Pitfalls

- Large unrelated changes coexist in the working tree; avoid broad commits and scope quick-task artifacts to planning files.
- Chart helper logic is duplicated across two screens; future drift is possible without extraction.
- Lint currently reports 2 warnings (no blocking errors) in unrelated/react-hook areas.

## Recommended Execution Path

1. Do not re-edit core bug files unless validation fails.
2. Validate with lint + TypeScript noEmit.
3. Produce quick task artifacts (plan, summary, verification).
4. Update STATE quick task table and commit only quick-task documentation artifacts.
