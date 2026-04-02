# Requirements: LyftTrack

**Defined:** 2026-04-02
**Core Value:** Users can log and track training progress reliably, quickly, and without friction.

## v1 Requirements

### Body Weight Logging

- [ ] **CORE-01**: User can submit body weight during onboarding and the value is persisted.
- [ ] **CORE-02**: User can log body weight from profile and sees optimistic UI feedback before persistence confirmation.
- [ ] **CORE-03**: Weight validation rules are consistent between UI submission handlers and service writes, with explicit errors.

### Charts and Visualization

- [ ] **CHART-01**: Stats weekly and evolution charts render without stretching in supported screen widths.
- [ ] **CHART-02**: Stats and active workout chart Y-axis labels compact large values using k formatting with correct units.
- [ ] **CHART-03**: Stats and active workout charts prevent top-value clipping using padded max value/headroom.

### Quality and Regression Safety

- [ ] **QUAL-01**: Static type validation passes for the milestone changes (TypeScript noEmit).
- [ ] **QUAL-02**: Repository memory captures relevant bug-fix conventions for future iterations.

## v2 Requirements

No deferred requirements captured yet.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full chart redesign language | Corrective milestone focused on fidelity and reliability |
| New stats modules or metrics | Not required to solve current critical defects |
| Schema migrations beyond weight/chart stability | Avoid unnecessary backend scope expansion |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Pending |
| CORE-02 | Phase 1 | Pending |
| CORE-03 | Phase 1 | Pending |
| CHART-01 | Phase 2 | Pending |
| CHART-02 | Phase 2 | Pending |
| CHART-03 | Phase 2 | Pending |
| QUAL-01 | Phase 3 | Pending |
| QUAL-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after milestone v1.0 initialization*
