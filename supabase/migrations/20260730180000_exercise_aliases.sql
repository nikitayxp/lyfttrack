-- issue #112: import/display aliases for catalogue exercises (Hevy titles, synonyms)
alter table public.exercises
  add column if not exists aliases text[] not null default '{}';

comment on column public.exercises.aliases is
  'Extra match strings (Hevy titles, synonyms). Not shown in UI; used by import/search. Catalogue only.';
