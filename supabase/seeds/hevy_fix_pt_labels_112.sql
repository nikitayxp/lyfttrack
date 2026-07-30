-- Fix leftover bad PT labels and Remada newline alias (#112)
begin;
update public.exercises
set name_pt = 'Desenvolvimento Unilateral (Halter)'
where name_en = 'One Arm Shoulder Press (Dumbbell)' and not is_custom;

update public.exercises
set name_pt = 'Desenvolvimento (Maquina)'
where name_en = 'Leverage Shoulder Press (Machine)' and not is_custom;

update public.exercises
set name_pt = 'Desenvolvimento no Smith (Maquina)'
where name_en = 'Smith Overhead Shoulder Press (Machine)' and not is_custom;

update public.exercises
set name_pt = 'Supino Inclinado (Barra)'
where name_en = 'Incline Bench Press Medium Grip (Barbell)' and not is_custom;

update public.exercises
set name = 'Row (Barbell)', name_en = 'Row (Barbell)', name_pt = 'Remada (Barra)',
    aliases = array(select distinct x from unnest(coalesce(aliases,'{}') || array['Remada (Barra)']) as x)
where not is_custom and (name_pt ilike 'Remada (Barra)%' or name_en = 'Row (Barbell)');

-- Drop leftover Portuguese crumbs in English names from crude translator
update public.exercises set name_en = 'Bicep Curl (Cable)', name = 'Bicep Curl (Cable)'
where name_en = 'Bicep Curl Na (Cable)' and not is_custom;
update public.exercises set name_en = 'Incline Bench Press (Machine)', name = 'Incline Bench Press (Machine)'
where name_en = 'Incline Bench Press Na (Machine)' and not is_custom;
update public.exercises set name_en = 'Lat Pulldown (Band)', name = 'Lat Pulldown (Band)'
where name_en = 'Lat Pulldown Elastico (Cable)' and not is_custom;
update public.exercises set name_en = 'Hanging Knee Raise (Bodyweight)', name = 'Hanging Knee Raise (Bodyweight)', equipment = 'bodyweight'
where name_en ilike 'Hanging Knee Raise Nas Barras%' and not is_custom;
update public.exercises set name_en = 'Incline Fly (Dumbbell)', name = 'Incline Fly (Dumbbell)', equipment = 'dumbbell'
where name_en = 'Fly Incline (Machine)' and name_pt = 'Crucifixo Inclinado' and not is_custom;
commit;
