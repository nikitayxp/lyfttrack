# LyftTrack

## What This Is

LyftTrack is a fitness product composed of an Expo mobile app and a Next.js marketing site. The mobile app focuses on workouts, body metrics, social feed interactions, and progress tracking for regular gym users.

## Core Value

Users can log and track training progress reliably, quickly, and without friction.

## Current Milestone: v1.0 Correcao Core: Peso e Graficos

**Goal:** Stabilize critical body-weight logging and chart rendering behavior so core progress tracking is trustworthy.

**Target features:**
- Reliable body-weight submission in onboarding and profile flows.
- Consistent chart formatting and responsive rendering in stats and active workout views.
- Strong regression safety for these fixes through static validation and documented conventions.

## Requirements

### Validated

- Authenticated users can access tabs and keep session state.
- Users can run active workouts and persist completed training sets.
- Users can open stats and social/profile screens with production data services.

### Active

- [ ] CORE-01: Body weight can be submitted in onboarding and persisted.
- [ ] CORE-02: Body weight can be logged from profile with optimistic UI behavior.
- [ ] CORE-03: Weight validation remains consistent between UI and service layers.
- [ ] CHART-01: Stats and active workout charts render responsively without clipping.
- [ ] CHART-02: Large chart values are compact-formatted with correct units.
- [ ] QUAL-01: TypeScript validation remains clean after milestone changes.

### Out of Scope

- Full visual redesign of stats or workout screens - this milestone is corrective.
- New analytics features beyond fixing existing chart fidelity.
- Database schema expansion unrelated to body-weight and chart stability.

## Context

This milestone is corrective work focused on two production-critical bugs: body-weight registration reliability and chart rendering/formatting quality. The codebase is a TypeScript Expo app using Supabase-backed services and react-native-gifted-charts for visualizations.

## Constraints

- **Platform**: Expo Router + React Native - Changes must preserve current route architecture.
- **Data**: Supabase service contracts - Fixes must stay compatible with existing service types and table usage.
- **Scope**: Corrective-only milestone - No net-new product features.
- **Quality**: Type-safe delivery - TypeScript checks must pass with no new errors.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Centralize body-weight max guard in service and reuse in UI | Prevent validation drift and silent clamp behavior | ✓ Good |
| Clamp chart width against mobile container limits on desktop web | Avoid stretched charts when window width exceeds app shell width | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via /gsd-transition):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. What This Is still accurate? -> Update if drifted

**After each milestone** (via /gsd-complete-milestone):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-02 after milestone v1.0 initialization*
