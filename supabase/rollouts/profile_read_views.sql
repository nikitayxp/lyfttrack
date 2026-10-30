begin;

create or replace view public.profile_cards
with (security_barrier = true)
as
select p.id, p.username, p.avatar_url, p.visibility, p.updated_at,
  case when public.can_view_user_content(p.id) then p.full_name end as full_name
from public.profiles p;

create or replace view public.profile_private_details
with (security_barrier = true)
as
select p.id, p.bio,
  case when p.id = (select auth.uid()) then p.height_cm end as height_cm,
  p.full_name
from public.profiles p
where public.can_view_user_content(p.id);

revoke all on public.profile_cards, public.profile_private_details from public, anon, authenticated;
grant select on public.profile_cards, public.profile_private_details to authenticated;

notify pgrst, 'reload schema';

commit;
