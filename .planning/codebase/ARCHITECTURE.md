# ARCHITECTURE

## Scope

System architecture map for mobile app + site in monorepo `C:\LyftTrack`.

## High-Level Topology

- Product is split into two deployable fronts:
  - Mobile: Expo/React Native app in `app/`.
  - Web marketing/blog: Next.js app in `site/`.
- Shared code between mobile and site is not centralized in a shared package yet.

## Mobile Architecture (`app/`)

### Routing and Screen Composition

- Expo Router file-based routes in `app/app/*`.
- Route groups:
  - `app/app/(auth)/*` for auth and onboarding flow.
  - `app/app/(tabs)/*` for main signed-in experience.
  - `app/app/workout/*` for full-screen workout routes.
- Root stack and session redirect logic are in `app/app/_layout.tsx`.

### State Ownership Model

- Global app-level state is split by domain context:
  - `PreferencesProvider` in `app/src/context/PreferencesContext.tsx`.
  - `WorkoutProvider` in `app/src/context/WorkoutContext.tsx`.
- `WorkoutContext` owns active workout session state, timers, keep-awake lifecycle, and recovered draft handling.
- Lower-level mutable workout operations are encapsulated in `useActiveWorkoutState` (`app/src/hooks/useActiveWorkoutState.ts`).

### Data Access Layer

- Service-oriented access layer in `app/src/services/*`.
- Screens call service functions directly (no separate API client abstraction per feature).
- Typed table contracts come from `app/src/types/database.ts`.
- Main service domains:
  - Auth/client bootstrap: `supabase.ts`
  - Workout/session persistence: `workoutService.ts`, `sessionRepository.ts`
  - Stats aggregation: `statsService.ts`
  - Profile and avatar: `profileService.ts`
  - Body measurements: `measurementService.ts`
  - Social interactions: `socialService.ts`, `interactionService.ts`

### Core Mobile Data Flows

- Auth routing flow:
  - `app/app/_layout.tsx` observes Supabase session and redirects between `/(auth)` and `/(tabs)`.
- Workout save flow:
  - UI in `app/app/workout/active.tsx` -> context drafts -> `sessionRepository.finishWorkout(...)` -> Supabase (`workouts`, `workout_exercises`, `sets`).
- Weight log flow:
  - Profile/onboarding handlers -> `measurementService.addWeight(...)` -> `body_measurements`.
- Stats flow:
  - Stats screens (`app/app/(tabs)/stats.tsx` and modal in `app/app/workout/active.tsx`) -> `statsService` aggregations over `sets` + joined `workouts`/`exercises`.

### Offline/Resilience Pattern

- Active workout resilience is local-first for in-progress draft state:
  - Debounced AsyncStorage writes in `app/src/services/offlineSyncService.ts`.
  - Recovery path in `useActiveWorkoutState` on app restart.
- Persistence to Supabase remains online and explicit at workout finish.

## Website Architecture (`site/`)

### Rendering Model

- Next.js App Router in `site/src/app/*`.
- Primary home entry: `site/src/app/page.tsx` -> `LandingShell`.
- Blog dynamic route: `site/src/app/blog/[slug]/page.tsx` with static params from local data.

### Content/Data Model

- Content is static TypeScript data for now:
  - `site/src/lib/marketing-data.ts`
  - `site/src/lib/blog-data.ts`
- No backend API dependency for mapped website features.

## Layer Boundaries

- UI components:
  - Mobile UI components in `app/src/components/*`.
  - Website UI components in `site/src/components/*`.
- Domain services:
  - Mobile only, under `app/src/services/*`.
- Utilities/helpers:
  - `app/src/utils/*` for parsing, formatting, and validation.
- Constants/theme:
  - `app/src/constants/*`.

## Architectural Characteristics

- Strong TypeScript-first approach with strict mode in both workspaces.
- Practical service-first architecture (feature screens call services directly).
- Route-driven product segmentation is clear and explicit.
- Some files are becoming high-churn and large (`workoutService.ts`, `active.tsx`, `profile.tsx`).

## Immediate Refactor Candidates

- Split monolithic UI files:
  - `app/app/workout/active.tsx`
  - `app/app/(tabs)/profile.tsx`
- Split oversized service module:
  - `app/src/services/workoutService.ts`
- Consider a shared formatting module for chart label/headroom behavior used by both stats contexts.
