# Roadmap: LyftTrack

## Overview

Milestone v1.0 Correcao Core: Peso e Graficos delivers a corrective path: first stabilize body-weight logging, then fix chart fidelity, and finally lock in verification and reusable team knowledge.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Body Weight Reliability** - Fix onboarding/profile submission flow and validation consistency. (completed 2026-04-02)
- [ ] **Phase 2: Chart Fidelity and Responsiveness** - Correct formatting, width, and clipping behavior in stats and active workout charts.
- [ ] **Phase 3: Verification and Knowledge Capture** - Validate static quality gates and record conventions for future maintenance.

## Phase Details

### Phase 1: Body Weight Reliability
**Goal**: Ensure body-weight logging works predictably across onboarding and profile flows.
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, CORE-02, CORE-03
**Success Criteria** (what must be TRUE):
  1. Onboarding body-weight save persists correctly and provides clear user feedback.
  2. Profile quick-log weight updates instantly (optimistic UI) and reconciles with stored history.
  3. Invalid/out-of-range weight inputs fail with explicit validation messages and no silent clamp.
**Plans**: 2 plans

Plans:
- [x] 01-01: Align weight validation/contracts across UI and measurement service.
- [x] 01-02: Harden onboarding and profile save flows with optimistic behavior.

### Phase 2: Chart Fidelity and Responsiveness
**Goal**: Make chart rendering stable and readable on mobile and desktop-web shell widths.
**Depends on**: Phase 1
**Requirements**: CHART-01, CHART-02, CHART-03
**Success Criteria** (what must be TRUE):
  1. Stats and active workout charts do not stretch outside the app container width.
  2. Large Y-axis values use compact labels with expected units.
  3. Peak data points do not clip at chart top due to insufficient headroom.
**Plans**: 2 plans

Plans:
- [ ] 02-01: Tune chart width/headroom/spacing props for stats and active workout.
- [ ] 02-02: Normalize axis and selected-point formatting for large numeric values.

### Phase 3: Verification and Knowledge Capture
**Goal**: Confirm quality gates and institutionalize the fix patterns.
**Depends on**: Phase 2
**Requirements**: QUAL-01, QUAL-02
**Success Criteria** (what must be TRUE):
  1. TypeScript noEmit check passes after milestone changes.
  2. Repository memory contains concise conventions for weight and chart bug prevention.
**Plans**: 1 plan

Plans:
- [ ] 03-01: Run validation checks and persist milestone conventions in memory docs.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Body Weight Reliability | 2/2 | Complete   | 2026-04-02 |
| 2. Chart Fidelity and Responsiveness | 0/2 | Not started | - |
| 3. Verification and Knowledge Capture | 0/1 | Not started | - |
