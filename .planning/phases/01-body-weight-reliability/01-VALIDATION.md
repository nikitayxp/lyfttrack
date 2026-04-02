---
phase: 1
slug: body-weight-reliability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 1 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Expo lint + TypeScript static checks |
| **Config file** | `app/eslint.config.js`, `app/tsconfig.json` |
| **Quick run command** | `npm run lint --workspace=app` |
| **Full suite command** | `npm run lint --workspace=app` then `npx tsc --noEmit -p app/tsconfig.json` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint --workspace=app`
- **After every plan wave:** Run `npm run lint --workspace=app` and `npx tsc --noEmit -p app/tsconfig.json`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01-01 | 1 | CORE-03 | static | `npm run lint --workspace=app` | ✅ | ⬜ pending |
| 01-01-02 | 01-01 | 1 | CORE-03 | static | `npx tsc --noEmit -p app/tsconfig.json` | ✅ | ⬜ pending |
| 01-02-01 | 01-02 | 2 | CORE-01 | static + manual | `npm run lint --workspace=app` | ✅ | ⬜ pending |
| 01-02-02 | 01-02 | 2 | CORE-02 | static + manual | `npx tsc --noEmit -p app/tsconfig.json` | ✅ | ⬜ pending |
| 01-02-03 | 01-02 | 2 | CORE-03 | static + manual | `npm run lint --workspace=app` and `npx tsc --noEmit -p app/tsconfig.json` | ✅ | ⬜ pending |

*Status: ⬜ pending - ✅ green - ❌ red - ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/src/services/measurementService.ts` body-weight parser/validator extracted and shared by UI callers
- [ ] `app/src/utils/inputValidation.ts` dedicated body-weight limit constant(s) separated from workout-set limits
- [ ] `app/app/(auth)/onboarding.tsx` and `app/app/(tabs)/profile.tsx` consume shared validation contract

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Onboarding save persists body weight | CORE-01 | Needs real navigation and persistence flow check | Complete onboarding with valid weight, navigate to profile, confirm latest entry is present, restart app/session and confirm persistence |
| Profile quick-log optimistic feedback and rollback | CORE-02 | Requires observing optimistic insert before async write resolution | Save valid weight in profile quick-log and confirm immediate UI update, then verify value survives reconciliation; force write failure and confirm rollback + error feedback |
| Validation consistency and explicit errors | CORE-03 | UX and service boundary checks across two entrypoints | Submit empty, non-numeric, <= 0, and above-max values in onboarding and profile; verify explicit errors and no silent clamp/insert |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
