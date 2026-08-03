begin;
-- Canonical laterals: use Hevy standing names (FED standing rows were merged earlier)
update public.exercises set
  name = 'Side Lateral Raise (Dumbbell)',
  name_en = 'Side Lateral Raise (Dumbbell)',
  name_pt = 'Elevação Lateral (Halter)',
  listed = true,
  aliases = array(
    select distinct x from unnest(coalesce(aliases,'{}') || array[
      'Seated Side Lateral Raise (Dumbbell)',
      'Elevacao Lateral Sentada (Halter)',
      'Elevação Lateral Sentada (Halter)',
      'Lateral Raise (Dumbbell)'
    ]) as x
  )
where id = 'f976b159-1ba2-56e7-a0c7-d5da1f6d5f21'::uuid;

update public.exercises set
  name = 'Lateral Raise (Cable)',
  name_en = 'Lateral Raise (Cable)',
  name_pt = 'Elevação Lateral (Cabo)',
  listed = true,
  aliases = array(
    select distinct x from unnest(coalesce(aliases,'{}') || array[
      'Seated Lateral Raise (Cable)',
      'Elevacao Lateral Sentada (Polia)',
      'Elevação Lateral Sentada (Polia)',
      'Side Lateral Raise (Cable)'
    ]) as x
  )
where id = 'bfcae318-1657-5d50-b11c-f58af4e54e50'::uuid;

-- Seated Press clone stays unlisted; shoulder press dumbbell stays listed with Hevy aliases
update public.exercises set listed = false where name_en = 'Seated Press (Dumbbell)' and not is_custom;
update public.exercises set
  listed = true,
  name_pt = 'Desenvolvimento Sentado (Halter)',
  aliases = array(
    select distinct x from unnest(coalesce(aliases,'{}') || array[
      'Press De Ombros (Sentada) (Halter)',
      'Seated Press (Dumbbell)',
      'Press Sentado (Halter)'
    ]) as x
  )
where name_en = 'Seated Shoulder Press (Dumbbell)' and not is_custom;

-- Puxada alta Hevy title → listed Lat Pulldown (Machine)
update public.exercises set
  listed = true,
  name_pt = 'Puxada Alta na Polia (Máquina)',
  aliases = array(
    select distinct x from unnest(coalesce(aliases,'{}') || array[
      'Puxada Alta na Polia (Máquina)',
      'Puxada Alta (Máquina)',
      'Lat Pulldown (Machine)',
      'Puxada Alta (Maquina)'
    ]) as x
  )
where name_en = 'Lat Pulldown (Machine)' and not is_custom;

commit;
