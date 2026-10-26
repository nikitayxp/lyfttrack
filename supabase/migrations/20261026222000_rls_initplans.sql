alter policy body_measurements_insert_own on public.body_measurements to authenticated
with check (((select auth.uid()) = user_id));

alter policy body_measurements_select_own on public.body_measurements to authenticated
using (((select auth.uid()) = user_id));

alter policy body_measurements_update_own on public.body_measurements to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

alter policy friend_requests_insert_own on public.friend_requests to authenticated
with check ((((select auth.uid()) = from_user_id) AND (to_user_id <> (select auth.uid())) AND (status = 'pending'::text)));

alter policy friend_requests_select_own on public.friend_requests to authenticated
using ((((select auth.uid()) = from_user_id) OR ((select auth.uid()) = to_user_id)));

alter policy friend_requests_update_recipient on public.friend_requests to authenticated
using ((((select auth.uid()) = to_user_id) AND (status = 'pending'::text)))
with check ((((select auth.uid()) = to_user_id) AND (status = ANY (ARRAY['accepted'::text, 'rejected'::text]))));

alter policy friends_delete_own on public.friends to authenticated
using ((((select auth.uid()) = user_low_id) OR ((select auth.uid()) = user_high_id)));

alter policy friends_select_own_network on public.friends to authenticated
using ((((select auth.uid()) = user_low_id) OR ((select auth.uid()) = user_high_id)));

alter policy profiles_insert_own on public.profiles to authenticated
with check (((select auth.uid()) = id));

alter policy profiles_update_own on public.profiles to authenticated
using (((select auth.uid()) = id))
with check (((select auth.uid()) = id));

alter policy routine_exercises_delete_owner_only on public.routine_exercises to authenticated
using ((EXISTS ( SELECT 1
   FROM routines r
  WHERE ((r.id = routine_exercises.routine_id) AND (r.user_id = (select auth.uid()))))));

alter policy routine_exercises_insert_owner_only on public.routine_exercises to authenticated
with check ((EXISTS ( SELECT 1
   FROM routines r
  WHERE ((r.id = routine_exercises.routine_id) AND (r.user_id = (select auth.uid()))))));

alter policy routine_exercises_select_visible_routines on public.routine_exercises to authenticated
using ((EXISTS ( SELECT 1
   FROM routines r
  WHERE ((r.id = routine_exercises.routine_id) AND ((r.user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM friends f
          WHERE ((f.user_low_id = LEAST((select auth.uid()), r.user_id)) AND (f.user_high_id = GREATEST((select auth.uid()), r.user_id))))))))));

alter policy routine_exercises_update_owner_only on public.routine_exercises to authenticated
using ((EXISTS ( SELECT 1
   FROM routines r
  WHERE ((r.id = routine_exercises.routine_id) AND (r.user_id = (select auth.uid()))))))
with check ((EXISTS ( SELECT 1
   FROM routines r
  WHERE ((r.id = routine_exercises.routine_id) AND (r.user_id = (select auth.uid()))))));

alter policy routines_delete_own on public.routines to authenticated
using ((user_id = (select auth.uid())));

alter policy routines_insert_own on public.routines to authenticated
with check ((user_id = (select auth.uid())));

alter policy routines_select_self_or_friends on public.routines to authenticated
using (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM friends f
  WHERE ((f.user_low_id = LEAST((select auth.uid()), routines.user_id)) AND (f.user_high_id = GREATEST((select auth.uid()), routines.user_id)))))));

alter policy routines_update_own on public.routines to authenticated
using ((user_id = (select auth.uid())))
with check ((user_id = (select auth.uid())));

alter policy sets_delete_owner_only on public.sets to authenticated
using ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = sets.workout_id) AND (w.user_id = (select auth.uid()))))));

alter policy sets_insert_owner_only on public.sets to authenticated
with check ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = sets.workout_id) AND (w.user_id = (select auth.uid()))))));

alter policy sets_update_owner_only on public.sets to authenticated
using ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = sets.workout_id) AND (w.user_id = (select auth.uid()))))))
with check ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = sets.workout_id) AND (w.user_id = (select auth.uid()))))));

alter policy template_exercises_delete_owner_templates on public.template_exercises to authenticated
using ((EXISTS ( SELECT 1
   FROM workout_templates wt
  WHERE ((wt.id = template_exercises.template_id) AND (wt.user_id = (select auth.uid()))))));

alter policy template_exercises_insert_owner_templates on public.template_exercises to authenticated
with check ((EXISTS ( SELECT 1
   FROM workout_templates wt
  WHERE ((wt.id = template_exercises.template_id) AND (wt.user_id = (select auth.uid()))))));

alter policy template_exercises_select_owner_templates on public.template_exercises to authenticated
using ((EXISTS ( SELECT 1
   FROM workout_templates wt
  WHERE ((wt.id = template_exercises.template_id) AND (wt.user_id = (select auth.uid()))))));

alter policy template_exercises_update_owner_templates on public.template_exercises to authenticated
using ((EXISTS ( SELECT 1
   FROM workout_templates wt
  WHERE ((wt.id = template_exercises.template_id) AND (wt.user_id = (select auth.uid()))))))
with check ((EXISTS ( SELECT 1
   FROM workout_templates wt
  WHERE ((wt.id = template_exercises.template_id) AND (wt.user_id = (select auth.uid()))))));

alter policy workout_comments_delete_own on public.workout_comments to authenticated
using (((select auth.uid()) = user_id));

alter policy workout_comments_insert_own_on_visible_workout on public.workout_comments to authenticated
with check ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_comments.workout_id) AND can_view_user_content(w.user_id))))));

alter policy workout_comments_update_own on public.workout_comments to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

alter policy workout_exercises_delete_owner_only on public.workout_exercises to authenticated
using ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_exercises.workout_id) AND (w.user_id = (select auth.uid()))))));

alter policy workout_exercises_insert_owner_only on public.workout_exercises to authenticated
with check ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_exercises.workout_id) AND (w.user_id = (select auth.uid()))))));

alter policy workout_exercises_update_owner_only on public.workout_exercises to authenticated
using ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_exercises.workout_id) AND (w.user_id = (select auth.uid()))))))
with check ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_exercises.workout_id) AND (w.user_id = (select auth.uid()))))));

alter policy workout_likes_delete_own on public.workout_likes to authenticated
using (((select auth.uid()) = user_id));

alter policy workout_likes_insert_own_on_visible_workout on public.workout_likes to authenticated
with check ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_likes.workout_id) AND can_view_user_content(w.user_id))))));

alter policy workout_templates_delete_own on public.workout_templates to authenticated
using ((user_id = (select auth.uid())));

alter policy workout_templates_insert_own on public.workout_templates to authenticated
with check ((user_id = (select auth.uid())));

alter policy workout_templates_select_own on public.workout_templates to authenticated
using ((user_id = (select auth.uid())));

alter policy workout_templates_update_own on public.workout_templates to authenticated
using ((user_id = (select auth.uid())))
with check ((user_id = (select auth.uid())));

alter policy workouts_delete_own on public.workouts to authenticated
using (((select auth.uid()) = user_id));

alter policy workouts_insert_own on public.workouts to authenticated
with check (((select auth.uid()) = user_id));

alter policy workouts_update_own on public.workouts to authenticated
using (((select auth.uid()) = user_id))
with check (((select auth.uid()) = user_id));

create or replace function public.can_view_user_content(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when target_user_id is null then false
    when (select auth.uid()) = target_user_id then true
    else exists (
      select 1 from public.profiles p where p.id = target_user_id
      and (p.visibility = 'public' or (p.visibility = 'friends' and exists (
        select 1 from public.friends f
        where f.user_low_id = least((select auth.uid()), target_user_id)
          and f.user_high_id = greatest((select auth.uid()), target_user_id)
      )))
    )
  end;
$$;
revoke all on function public.can_view_user_content(uuid) from public, anon;
grant execute on function public.can_view_user_content(uuid) to authenticated;
