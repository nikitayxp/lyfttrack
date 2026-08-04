# Supabase Migrations

This directory is now the SQL migration source tracked in git for LyftTrack.

File names must be `<14-digit timestamp>_name.sql`. The timestamp is the version the
CLI records, so two files can never share one, and the order they sort in is the order
they run in. The first four here used 8 digits until #149, and two of them collided.

## Current baseline migrations

1. 20260407000000_fix_body_measurements_rls.sql
   - Enables RLS on body_measurements.
   - Adds authenticated own-row SELECT/INSERT/UPDATE policies.

2. 20260409000000_schema_contract_hardening.sql
   - Adds measured_at to body_measurements and backfills from created_at.
   - Adds exercises i18n columns (name_en, name_pt, muscle_en, muscle_pt).
   - Makes sets.set_type accept both drop and dropset for compatibility.
   - Adds social dedupe + integrity indexes/checks.
   - Adds high-value query indexes for feed/social/stats/weights.

3. 20260409010000_rls_security_hardening.sql
   - Enables RLS on all app-facing tables and resets policies to canonical ownership/visibility rules.
   - Adds atomic RPC `respond_to_friend_request(uuid, text)` for accept/reject flow.
   - Adds profile trigger to keep profiles.updated_at synchronized on updates.
   - Its workout SELECT policies are superseded by 20260727090000. Running this one
     after that one puts public profiles back to friends-only.

4. 20260421000000_hevy_parity_features.sql
   - Adds exercises.description and workout_exercises.notes, both capped at 1000 chars.
   - Adds sets.side (both/left/right) for unilateral work, plus an index on it.
   - Adds the `wipe_my_workouts()` and `wipe_my_custom_exercises()` helpers, gated on
     auth.uid() so they only ever touch the caller's own rows.

5. 20260727090000_public_profile_visibility.sql
   - Adds `can_view_user_content(uuid)` helper and rewrites the SELECT policies for
     workouts, workout_exercises, sets, workout_likes and workout_comments to use it.
   - Makes `profiles.visibility = 'public'` actually grant read access; previously the
     column was never consulted by any policy, so public behaved like friends-only.
   - Backfills NULL visibility to 'friends' and sets that as the column default.

6. 20260727091000_delete_own_account.sql
   - Adds `delete_own_account()` RPC so a user can delete their own account.
   - Removes every row keyed to that user across workouts, sets, routines, templates,
     measurements, social graph and profile, then the auth.users row last.
   - Custom exercises are removed only when nothing still references them (sets,
     workout_exercises, template_exercises or routine_exercises).
   - Stored avatars are removed client-side before the RPC runs, while the session
     is still valid.

7. 20260727194500_catalog_vs_custom_privacy.sql
   - Removes test custom Preacher Curl (dumbbell) after remapping history to the
     built-in machine Rosca Scott / Preacher Curl.
   - Promotes remaining wrongly-marked customs to shared catalogue
     (`is_custom = false`, `created_by = null`).
   - SELECT: catalogue for all authenticated users; customs only for their owner.
   - UPDATE/DELETE limited to own custom rows.

8. 20260727200000_exercises_schema_cleanup.sql
   - Documents column contract via COMMENT.
   - Normalises equipment / muscle_group casing and known aliases.
   - Syncs catalogue `name` to `name_en`; fills missing muscle labels.
   - CHECK ownership invariants + index `(is_custom, created_by)`.

9. 20260727230000_profiles_height_cm.sql
   - Adds optional profiles.height_cm for onboarding and profile edit.

10. 20260730180000_exercise_aliases.sql
    - Adds exercises.aliases, the extra match strings used by import and search.

11. 20260803170000_exercise_listed.sql
    - Adds exercises.listed so unlisted rows stay matchable by import and history
      while being hidden from the picker.

## Rollout notes

- Apply first in staging and validate app flows:
   - onboarding weight save
   - profile weight history
   - create custom exercise
   - save workout
   - feed load and like/comment
   - social request/accept/reject
   - stats charts
   - public profile visibility (self vs friend)
   - template save/load with rest intervals
- If large table sizes exist, schedule a low-traffic window for index creation.
- Keep app schema types aligned with production after each migration.
