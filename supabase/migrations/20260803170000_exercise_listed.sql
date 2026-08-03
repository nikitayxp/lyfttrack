-- issue #112: slim picker — unlisted rows stay for import/history, hidden from catalogue UI
alter table public.exercises
  add column if not exists listed boolean not null default true;

comment on column public.exercises.listed is
  'Catalogue picker visibility. false = hidden from picker/search library but still matchable via import aliases / history.';
