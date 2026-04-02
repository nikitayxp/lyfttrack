# INTEGRATIONS

## Scope

External systems, data boundaries, and integration points in `C:\LyftTrack`.

## Primary Backend: Supabase

### Client Setup

- Supabase client is initialized in `app/src/services/supabase.ts`.
- Auth persistence uses platform-aware storage:
  - Web: `window.localStorage` (when available).
  - Native: `@react-native-async-storage/async-storage`.

### Auth Integration

- Session bootstrap and auth-state listeners are used in:
  - `app/app/_layout.tsx` (route redirection auth vs tabs)
  - `app/src/context/WorkoutContext.tsx` (current user id for workout state)
- Core methods observed:
  - `supabase.auth.getSession()`
  - `supabase.auth.onAuthStateChange(...)`
  - `supabase.auth.getUser()`

### Database Tables Consumed (Mobile)

- User/profile domain:
  - `profiles`
  - `body_measurements`
  - `friend_requests`
  - `friends`
- Training domain:
  - `exercises`
  - `workouts`
  - `sets`
  - `workout_exercises`
  - `routines`
  - `routine_exercises`
  - `workout_templates`
  - `template_exercises`
- Social interaction domain:
  - `workout_likes`
  - `workout_comments`

Typed contracts are generated in `app/src/types/database.ts` and consumed across `app/src/services/*`.

### Storage Integration

- Avatar uploads use Supabase Storage bucket `avatars` in `app/src/services/profileService.ts`.
- Upload flow combines Expo image picker + fetch/arrayBuffer fallback + storage upload.

## Device/Platform Integrations

- Media library permission and image selection:
  - `expo-image-picker` in `app/src/services/profileService.ts`.
- Share integration:
  - `expo-sharing` and `react-native-view-shot` in `app/app/(tabs)/profile.tsx`.
- Keep-awake session behavior:
  - `expo-keep-awake` used by `app/src/context/WorkoutContext.tsx`.
- Localization:
  - `expo-localization` + i18next in `app/src/i18n/*`.

## Local Persistence Integrations

- App preferences persisted in AsyncStorage via `app/src/context/PreferencesContext.tsx`.
- Active workout draft persisted in AsyncStorage via `app/src/services/offlineSyncService.ts`.
- Draft keying is user-scoped (`lyfttrack:workout_draft:<userId>`), reducing cross-account collisions.

## Website Integrations (`site/`)

- No live external API integration detected in current site code.
- Content for home/blog is local in TypeScript modules:
  - `site/src/lib/marketing-data.ts`
  - `site/src/lib/blog-data.ts`
- Runtime/deploy integration target appears Vercel (`site/vercel.json`).

## Security and Secrets Boundaries

- Mobile uses public Expo env vars for Supabase URL/anon key only.
- Missing env vars fail fast at startup in `app/src/services/supabase.ts`.
- No hardcoded API secrets found in source files reviewed.
- No webhook receiver or server-side token exchange layer present in this repo.

## Reliability Patterns in Integrations

- Supabase schema drift fallbacks implemented for key paths:
  - `body_measurements.measured_at` fallback in `app/src/services/measurementService.ts`.
  - Legacy `workout_exercises` / `workout_exercise_id` fallbacks in `app/src/services/sessionRepository.ts` and `app/src/services/workoutService.ts`.
- UI layer uses optimistic update patterns for social interactions and weight logging in `app/app/(tabs)/profile.tsx`.

## Gaps

- No explicit retry/backoff wrapper around Supabase requests.
- No centralized network observability or request tracing integration.
- Site currently has no CMS or analytics provider integration in mapped code.
