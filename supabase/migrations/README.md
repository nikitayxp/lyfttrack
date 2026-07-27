# Supabase Migrations

This directory is now the SQL migration source tracked in git for LyftTrack.

## Current baseline migrations

1. 20260407_fix_body_measurements_rls.sql
   - Enables RLS on body_measurements.
   - Adds authenticated own-row SELECT/INSERT/UPDATE policies.

2. 20260409_schema_contract_hardening.sql
   - Adds measured_at to body_measurements and backfills from created_at.
   - Adds exercises i18n columns (name_en, name_pt, muscle_en, muscle_pt).
   - Makes sets.set_type accept both drop and dropset for compatibility.
   - Adds social dedupe + integrity indexes/checks.
   - Adds high-value query indexes for feed/social/stats/weights.

3. 20260409_z_rls_security_hardening.sql
   - Enables RLS on all app-facing tables and resets policies to canonical ownership/visibility rules.
   - Adds atomic RPC `respond_to_friend_request(uuid, text)` for accept/reject flow.
   - Adds profile trigger to keep profiles.updated_at synchronized on updates.

4. 20260727_public_profile_visibility.sql
   - Adds `can_view_user_content(uuid)` helper and rewrites the SELECT policies for
     workouts, workout_exercises, sets, workout_likes and workout_comments to use it.
   - Makes `profiles.visibility = 'public'` actually grant read access; previously the
     column was never consulted by any policy, so public behaved like friends-only.
   - Backfills NULL visibility to 'friends' and sets that as the column default.

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
