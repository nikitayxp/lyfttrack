begin;

revoke select on public.profiles from anon, authenticated;
grant select (id, username, full_name, avatar_url, visibility, updated_at) on public.profiles to authenticated;

create or replace view public.profile_details
with (security_barrier = true)
as
select
  p.id,
  p.bio,
  case when p.id = (select auth.uid()) then p.height_cm end as height_cm
from public.profiles p
where public.can_view_user_content(p.id);

revoke all on public.profile_details from public, anon, authenticated;
grant select on public.profile_details to authenticated;

commit;
