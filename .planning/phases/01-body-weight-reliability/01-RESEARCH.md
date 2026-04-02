# Phase 1: Body Weight Reliability - Research

Date: 2026-04-02
Scope: CORE-01, CORE-02, CORE-03 only

## Current State

Body-weight reliability logic is already mostly implemented in the app codebase.

| Requirement | Current Implementation Status | Evidence |
|---|---|---|
| CORE-01: Onboarding body weight persists | Implemented | `app/app/(auth)/onboarding.tsx` validates input, calls `updateProfile`, then calls `addWeight`; `app/src/services/measurementService.ts` writes to `body_measurements` with fallback when `measured_at` column is missing. |
| CORE-02: Profile quick log uses optimistic UI | Implemented | `app/app/(tabs)/profile.tsx` inserts an optimistic history entry before persistence, then reconciles/rolls back based on `addWeight` result. |
| CORE-03: Validation consistency + explicit errors | Partially implemented (functionally aligned, structurally duplicated) | UI handlers in onboarding/profile and service layer all enforce `> 0`, decimal normalization, and `<= BODY_WEIGHT_MAX_KG`; however rule logic is duplicated across files. |

Additional observations:
- `BODY_WEIGHT_MAX_KG` is sourced from `INPUT_LIMITS.weightMax`.
- `INPUT_LIMITS.weightMax` is also used in workout set/draft flows, so body-weight limits are currently coupled to workout load limits.
- There is no dedicated automated test suite for this flow; validation relies on lint/typecheck + manual runtime checks.

## Gap Analysis

1. Validation contract drift risk remains.
- Today: rules are repeated in onboarding/profile/service.
- Gap: no single parsing/validation entrypoint for body weight used by all submission paths.
- Planning implication: Phase 1 should centralize body-weight normalization/validation and make UI layers consume it directly.

2. Body-weight max limit is coupled with workout-set max limit.
- Today: both use `INPUT_LIMITS.weightMax`.
- Gap: changing body-weight policy could accidentally impact workout set entry behavior.
- Planning implication: split body-weight limit from general workout weight limits.

3. Onboarding save is two-step (profile update + weight insert) without atomic transaction.
- Today: if weight write fails, name update may already be persisted.
- Gap: partial success is possible.
- Planning implication: explicitly define acceptable behavior and retry UX for partial failure states.

4. Regression safety for CORE-01/02/03 is weak.
- Today: no automated tests around body-weight contract.
- Gap: future refactors can reintroduce silent clamp/drift.
- Planning implication: include at least unit-level coverage for parsing/validation contract and optimistic merge behavior.

## Risks

- High: Refactoring limits in `INPUT_LIMITS` can regress workout-set validation outside this phase if not decoupled first.
- Medium: Reintroducing `toSafeNumber(..., { max })` at UI boundaries can silently clamp and violate CORE-03.
- Medium: Optimistic state logic can create duplicate/incorrect history ordering if merge/reconcile behavior is changed without safeguards.
- Medium: Partial onboarding persistence (name saved, weight not saved) can create user confusion if retry messaging is not explicit.

## Recommended Plan Targets

Phase 1 plan should target these files directly.

Plan 01-01 (Align validation/contracts):
- `app/src/services/measurementService.ts`
  - Define/export a single body-weight parse/validate contract used by callers.
  - Keep explicit error messages for invalid/out-of-range input (no silent clamp).
- `app/src/utils/inputValidation.ts`
  - Introduce dedicated body-weight limit constant(s) to decouple from workout-set limits.
- `app/app/(auth)/onboarding.tsx`
  - Replace duplicated numeric guards with shared body-weight contract.
- `app/app/(tabs)/profile.tsx`
  - Replace duplicated numeric guards with shared body-weight contract.

Plan 01-02 (Harden onboarding/profile save flows + optimistic behavior):
- `app/app/(auth)/onboarding.tsx`
  - Preserve clear success/error feedback and explicit retry behavior for partial failures.
- `app/app/(tabs)/profile.tsx`
  - Preserve optimistic insert + rollback + reconciliation guarantees as non-regression criteria.
- `app/src/services/measurementService.ts`
  - Preserve compatibility fallback for `measured_at` schema variance and ensure errors remain actionable.

Optional but recommended for phase safety:
- Add focused tests once test runner is chosen (or document manual protocol if tests are deferred to Phase 3).

## Verification Strategy

Static gates (required in every Phase 1 plan execution):
1. `npm run lint --workspace=app`
2. `npx tsc --noEmit -p app/tsconfig.json`

Manual acceptance checks mapped to CORE requirements:
1. CORE-01 (Onboarding persistence)
- Complete onboarding with valid weight.
- Confirm latest body-weight entry appears after navigation to profile.
- Hard refresh app/session and confirm value still present.

2. CORE-02 (Profile optimistic UI)
- Open profile quick-log modal and save valid weight.
- Confirm UI updates immediately before network roundtrip completes.
- Confirm value remains after reconciliation/refresh.
- Force a write failure and confirm rollback + input restoration + explicit error.

3. CORE-03 (Validation consistency)
- Test empty, non-numeric, zero/negative, and above-max values in onboarding and profile.
- Confirm explicit validation errors and no insert attempt.
- Confirm same acceptance/rejection boundaries between UI handlers and service write.

Non-regression checks:
- Ensure workout set weight entry behavior is unchanged after any body-weight limit refactor.
- Ensure no silent clamp is introduced in any body-weight submission path.
