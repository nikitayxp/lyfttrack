-- #112: muscle group "other" — neck / rotator cuff / misc only (tighten false positives)
begin;

-- 1) Restore false positives that matched "neck" / "rotation" in compound names
update public.exercises set
  muscle_group = 'shoulders',
  muscle_en = 'Shoulders',
  muscle_pt = 'Ombros'
where not is_custom
  and (
    name_en ilike '%behind%neck%'
    or name_en ilike '%press behind neck%'
    or name_en ilike '%reverse fly%external rotation%'
  );

update public.exercises set
  muscle_group = 'back',
  muscle_en = 'Back',
  muscle_pt = 'Costas'
where not is_custom
  and (
    name_en ilike '%row to neck%'
    or name_en ilike '%pulldown behind%neck%'
    or name_en ilike '%pulldown%behind the neck%'
  );

update public.exercises set
  muscle_group = 'core',
  muscle_en = 'Core',
  muscle_pt = 'Core'
where not is_custom
  and name_en ilike '%pallof%rotation%';

update public.exercises set
  muscle_group = 'forearms',
  muscle_en = 'Forearms',
  muscle_pt = 'Antebracos'
where not is_custom
  and name_en ilike '%wrist rotation%';

-- 2) Canonical other: rotator + neck isolation (+ halo/serratus/cardio leftovers)
update public.exercises set
  muscle_group = 'other',
  muscle_en = 'Other',
  muscle_pt = 'Outro'
where not is_custom
  and (
    name_en in ('Rotação Externa', 'Rotação Interna')
    or name_pt in ('Rotação Externa', 'Rotação Interna')
    or name_en ~* '^(external|internal) rotation\b'
    or name_en ~* '^neck (extension|flexion)\b'
    or name_en ~* '^isometric neck\b'
    or name_en ~* '^halo\b'
    or name_en ~* '^serratus\b'
    or name_en in ('Running', 'Walking')
    or name_pt in ('Corrida', 'Caminhada')
    or coalesce(muscle_group, '') in ('full_body', 'cardio', 'neck')
  );

-- Neck Press = shoulder press variant, not isolation neck work
update public.exercises set
  muscle_group = 'shoulders',
  muscle_en = 'Shoulders',
  muscle_pt = 'Ombros'
where not is_custom
  and name_en ilike 'Neck Press%';

commit;
