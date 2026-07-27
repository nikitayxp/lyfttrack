-- Optional body height for onboarding / profile (cm).
alter table if exists public.profiles
  add column if not exists height_cm numeric(5, 1);

comment on column public.profiles.height_cm is
  'Optional standing height in centimetres; set during onboarding or profile edit.';
