# Supabase Migrations

This directory is now the SQL migration source tracked in git for LyftTrack.

File names must be `<14-digit timestamp>_name.sql`. The timestamp is the version the
CLI records, so two files can never share one, and the order they sort in is the order
they run in. The first four here used 8 digits until #149, and two of them collided.

## Existing-project boundary

These are forward migrations over the existing LyftTrack Supabase project, not a
complete schema for a fresh database. The original tables, auth/profile triggers,
Storage avatar bucket/read policy, and some deployed RPCs predate the tracked
history. A fresh `supabase db reset` is therefore not a supported reconstruction
of production yet. Do not mark older migrations applied or fabricate a baseline
without first comparing the actual project schema and migration history.

The issue #274 PGlite tests create minimal fixtures of the captured policies/RPC
and run the new SQL against them. They verify PostgreSQL permissions and RLS;
they do not provision Supabase Storage or validate a remote deployment. Apply and
test the migrations separately in staging before an authorized production rollout.

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

12. 20260804230000_default_profile_visibility_public.sql
    - Changes profiles.visibility default from 'friends' to 'public' for new accounts.
      Existing rows are left unchanged.

13. 20261019140000_avatar_storage_ownership.sql
    - Restricts avatar INSERT/UPDATE/DELETE to the authenticated user's first path
      segment, including the destination of an UPDATE; public reads stay available.

14. 20261019141000_restore_exercise_privacy.sql
    - Catalogue stays readable. Custom rows stay private to the owner, unless
      the exercise is already in a workout the viewer can open.
    - Own-custom insert, update and delete stay limited to that owner.
    - Does not change existing exercise data.

15. 20261019142000_username_availability_contract.sql
    - Versions the previously untracked `check_username_available(text)` RPC.
    - Preserves lower/trim lookup; rejects null, invalid or out-of-range names.
    - Uses an empty search_path and a qualified profiles lookup; grants only
      boolean availability to anon/authenticated so signup works before sign-in.

## Rollout notes

- `20261027090000_own_exercise_references.sql` restricts new workout, set,
  routine and template references to catalogue exercises or the current user's
  custom exercises.
- `20261027090100_repair_copied_exercise_references.sql` gives each affected
  account its own copy of historically shared custom exercises. It preserves
  translations, aliases, listing state, training row IDs and values. Legacy sets
  linked to a different workout are detached after retaining their exercise;
  linked sets without a workout inherit their existing block's workout.
- A custom-exercise set without either a workout or a block stops the repair
  with an explicit error. Its owner must be established before retrying; the
  migration never guesses ownership or deletes the set.
- The repair also requires every new or updated linked set to match its block's
  workout and exercise. Unlinked legacy sets remain supported.
- The repair runs in one transaction and briefly blocks writes to the affected
  tables, including account deletion. A five-second lock timeout or sixty-second
  statement timeout aborts it without a partial repair. Validate on staging and
  reconcile the earlier migration PRs before applying it in production.
- I split the profile privacy rollout into additive views, compatible clients,
  then permission revocation. `supabase/rollouts/profile_read_views.sql` only
  prepares `profile_cards` and `profile_private_details`; it does not revoke
  table access, modify profile data or mark migrations as applied. It requires
  a separately authorized execution in each target environment.
- I validate the additive views in staging before deploying this client. The
  new client needs both views to exist. Hidden cards retain username/avatar;
  the name is null unless `can_view_user_content` permits access. The private
  details endpoint uses the same visibility rule and keeps height owner-only.
  The old `profile_details` view remains unchanged.
- My active client for this rollout is the web app. I validate the compatible
  web deployment before the permission cutover. Old APK clients that use
  `profiles.select('*')` fail after revocation and require an update if used.
  I do not claim native compatibility or device validation from web checks.
- `20261027092000_private_profile_fields.sql` remains unchanged.
  `20261027092100_private_profile_cards.sql` then removes the globally readable
  name, including stale column/PUBLIC grants, and recreates the prepared views.
  I must reconcile recorded manual changes and earlier pending migrations
  before applying either; I do not skip or falsely mark the older migration.
- Production migration application now requires a manual workflow run on
  `main`, `apply_migrations=true`, and the full approved commit SHA matching
  both the event revision and the actual checkout. The confirmation defaults
  to false. Automatic pushes only print a notice. Approval is checked before
  linking with production credentials. The manual run applies **all** pending
  migrations, so the SHA review covers that entire set, not only profiles.
- Before that run I verify two-account profile visibility, hidden-name search,
  friendship/request cards, comments, feed, onboarding and profile edits through
  the real staging API and compatible app. I still require separate approval
  for merge and production changes; automated tests do not record it.
- The currently accessible project inventory contains only the linked
  production project. I have not created a staging project. On 29 October 2026
  I tested both privacy migrations on the real database in a transaction that
  rolled back, then applied only the explicitly approved additive view script.
  Profile rows, friendship rows and migration history were verified unchanged.
  On 30 October 2026 the approved #295/#299 merges were deployed at main
  `9c3482bfc227b5c6710af49d8bcb324493a57411`. The confirmed manual workflow applied
  only 092000 and 092100. Live grants and API/browser tests verified the cutover;
  test profile/friendship digests stayed unchanged. #288/#298 are closed for web.
  The earlier exercise timestamps 090000/090100 are still pending and require
  an explicitly reviewed include-all dry run; I do not mark them falsely applied.

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
