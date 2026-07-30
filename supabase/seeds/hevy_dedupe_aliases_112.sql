-- Deduplicate catalogue + aliases (#112) — strict seated/standing only
begin;
alter table public.exercises add column if not exists aliases text[] not null default '{}';
update public.exercises set name = 'Alternate Incline Curl (Dumbbell)', name_en = 'Alternate Incline Curl (Dumbbell)', name_pt = 'Alternate Inclinado Curl (Halter)', aliases = '{}'::text[] where id = '965c3dba-ee31-5461-aa75-41f67e59c65d'::uuid;
update public.exercises set name = 'Bench Press Medium Grip (Barbell)', name_en = 'Bench Press Medium Grip (Barbell)', name_pt = 'Supino Medium Grip (Barra)', aliases = '{}'::text[] where id = 'dcde9daf-93c4-5ebc-9460-93f2592f9ece'::uuid;
update public.exercises set name = 'Bench Press With Chains (Barbell)', name_en = 'Bench Press With Chains (Barbell)', name_pt = 'Supino With Chains (Barra)', aliases = '{}'::text[] where id = '4bbe9a5d-ee28-583b-905e-63979005b137'::uuid;
update public.exercises set name = 'Bench Press With Neutral Grip (Dumbbell)', name_en = 'Bench Press With Neutral Grip (Dumbbell)', name_pt = 'Supino With Neutral Grip (Halter)', aliases = '{}'::text[] where id = 'd112de28-e7d6-539a-a146-4547599b1a32'::uuid;
update public.exercises set name = 'Bent Over One Arm Long Bar Row (Barbell)', name_en = 'Bent Over One Arm Long Bar Row (Barbell)', name_pt = 'Bent Over Unilateral Long Bar Row (Barra)', aliases = '{}'::text[] where id = '1f92d32d-873c-5ea9-b008-ecdb295942ae'::uuid;
update public.exercises set name = 'Bicep Curl (Dumbbell)', name_en = 'Bicep Curl (Dumbbell)', name_pt = 'Bicep Rosca (Halter)', aliases = ARRAY['Rosca Direta (Halter)']::text[] where id = '289f9229-026a-5480-a61b-8ffad97a692c'::uuid;
update public.exercises set name = 'Close Grip Bench Press (Barbell)', name_en = 'Close Grip Bench Press (Barbell)', name_pt = 'Close Grip Supino (Barra)', aliases = '{}'::text[] where id = '37de6bd0-98de-5b0c-89f0-36b860fd0bec'::uuid;
update public.exercises set name = 'Close Grip Front Lat Pulldown (Cable)', name_en = 'Close Grip Front Lat Pulldown (Cable)', name_pt = 'Close Grip Front Puxada Alta (Polia)', aliases = '{}'::text[] where id = 'd3493900-565a-5528-ba81-25ccb7f3c933'::uuid;
update public.exercises set name = 'Close Grip Standing Curl (Barbell)', name_en = 'Close Grip Standing Curl (Barbell)', name_pt = 'Close Grip Em Pe Curl (Barra)', aliases = ARRAY['Close Grip Curl (Barbell)', 'Close Grip Rosca (Barra)', 'Close Grip Standing Rosca (Barra)']::text[] where id = '12f47577-1b98-5fc3-8a63-e399a3f6af16'::uuid;
update public.exercises set name = 'Curl Lying Against An Incline (Barbell)', name_en = 'Curl Lying Against An Incline (Barbell)', name_pt = 'Curl Deitado Against An Inclinado (Barra)', aliases = '{}'::text[] where id = 'ae2eade4-99df-5cbe-9241-485e4675c006'::uuid;
update public.exercises set name = 'Decline Close Grip Bench To Skull Crusher (Barbell)', name_en = 'Decline Close Grip Bench To Skull Crusher (Barbell)', name_pt = 'Declinado Close Grip Bench To Skull Crusher (Barra)', aliases = '{}'::text[] where id = '28a1a45d-d366-5d61-bb97-02ee78d16bb7'::uuid;
update public.exercises set name = 'Decline Crunch (Bodyweight)', name_en = 'Decline Crunch (Bodyweight)', name_pt = 'Declinado Crunch (Peso corporal)', aliases = '{}'::text[] where id = 'cae9a4ce-d6e3-59fb-95b9-0a84408240ca'::uuid;
update public.exercises set name = 'Decline Fly (Dumbbell)', name_en = 'Decline Fly (Dumbbell)', name_pt = 'Declinado Fly (Halter)', aliases = '{}'::text[] where id = '4d629afc-3184-5639-9986-b3f34c461ef7'::uuid;
update public.exercises set name = 'Decline Oblique Crunch (Bodyweight)', name_en = 'Decline Oblique Crunch (Bodyweight)', name_pt = 'Declinado Oblique Crunch (Peso corporal)', aliases = '{}'::text[] where id = '83871f4e-df6f-5783-9da2-554b64ab2c22'::uuid;
update public.exercises set name = 'Decline Reverse Crunch (Bodyweight)', name_en = 'Decline Reverse Crunch (Bodyweight)', name_pt = 'Declinado Reverse Crunch (Peso corporal)', aliases = '{}'::text[] where id = '4b121ff2-af80-552f-a593-3829ac4e8910'::uuid;
update public.exercises set name = 'Decline Smith Press (Machine)', name_en = 'Decline Smith Press (Machine)', name_pt = 'Declinado Smith Press (Maquina)', aliases = '{}'::text[] where id = '58d24a4e-c8ab-5b94-a080-1cd1cd603d4d'::uuid;
update public.exercises set name = 'Decline Triceps Extension (Barbell)', name_en = 'Decline Triceps Extension (Barbell)', name_pt = 'Declinado Triceps Extension (Barra)', aliases = '{}'::text[] where id = '45630c03-c6a8-5bef-b5fd-043f4ecde1f9'::uuid;
update public.exercises set name = 'Decline Triceps Extension (Dumbbell)', name_en = 'Decline Triceps Extension (Dumbbell)', name_pt = 'Declinado Triceps Extension (Halter)', aliases = '{}'::text[] where id = 'd1851cb5-788f-543c-b0bf-4e77e06d96ce'::uuid;
update public.exercises set name = 'Extended Range One Arm Floor Press (Kettlebell)', name_en = 'Extended Range One Arm Floor Press (Kettlebell)', name_pt = 'Extended Range Unilateral Floor Press (Kettlebell)', aliases = '{}'::text[] where id = '506f992a-e0f6-5cb4-825a-74c3c95ffb53'::uuid;
update public.exercises set name = 'Flat Bench Lying Leg Raise (Bodyweight)', name_en = 'Flat Bench Lying Leg Raise (Bodyweight)', name_pt = 'Flat Bench Deitado Leg Raise (Peso corporal)', aliases = '{}'::text[] where id = '4b4a1ab8-7269-51fa-beac-3469cc7a3ecb'::uuid;
update public.exercises set name = 'Flexor Incline Curl (Dumbbell)', name_en = 'Flexor Incline Curl (Dumbbell)', name_pt = 'Flexor Inclinado Curl (Halter)', aliases = '{}'::text[] where id = 'fb8f0caa-4228-5739-98dc-7ecde1c19160'::uuid;
update public.exercises set name = 'Front Incline Raise (Dumbbell)', name_en = 'Front Incline Raise (Dumbbell)', name_pt = 'Front Inclinado Raise (Halter)', aliases = '{}'::text[] where id = 'c7c6f462-a63d-5521-8c5f-700be834f14a'::uuid;
update public.exercises set name = 'Hammer Grip Incline Bench Press (Dumbbell)', name_en = 'Hammer Grip Incline Bench Press (Dumbbell)', name_pt = 'Hammer Grip Supino Inclinado (Halter)', aliases = '{}'::text[] where id = '97b09aec-6c7a-59b6-8015-68ab7f33024f'::uuid;
update public.exercises set name = 'Incline Bench Press Medium Grip (Barbell)', name_en = 'Incline Bench Press Medium Grip (Barbell)', name_pt = 'Supino Inclinado Medium Grip (Barra)', aliases = ARRAY['Incline Bench Press (Barbell)', 'Supino Inclinado (Barra)']::text[] where id = 'fb0ef7c0-939a-5d90-a198-adecee9726ab'::uuid;
update public.exercises set name = 'Incline Bench Pull (Barbell)', name_en = 'Incline Bench Pull (Barbell)', name_pt = 'Inclinado Bench Pull (Barra)', aliases = '{}'::text[] where id = '99f67d3f-3d80-5fd6-8247-7073b6e87a07'::uuid;
update public.exercises set name = 'Incline Bench With Palms Facing In (Dumbbell)', name_en = 'Incline Bench With Palms Facing In (Dumbbell)', name_pt = 'Inclinado Bench With Palms Facing In (Halter)', aliases = '{}'::text[] where id = '07e19c85-74d1-5b11-a0b3-7e5fab9fb5b6'::uuid;
update public.exercises set name = 'Incline Chest Press (Cable)', name_en = 'Incline Chest Press (Cable)', name_pt = 'Inclinado Chest Press (Polia)', aliases = '{}'::text[] where id = '3cc143f7-68c3-5825-9eb1-226891ea280e'::uuid;
update public.exercises set name = 'Incline Fly (Dumbbell)', name_en = 'Incline Fly (Dumbbell)', name_pt = 'Inclinado Fly (Halter)', aliases = '{}'::text[] where id = '61633195-dc97-5cbf-b550-9bbb0ee04ba3'::uuid;
update public.exercises set name = 'Incline Fly With A Twist (Dumbbell)', name_en = 'Incline Fly With A Twist (Dumbbell)', name_pt = 'Inclinado Fly With A Twist (Halter)', aliases = '{}'::text[] where id = '45edeeb2-bd93-58a9-b25c-c107043ad406'::uuid;
update public.exercises set name = 'Incline Flye (Cable)', name_en = 'Incline Flye (Cable)', name_pt = 'Inclinado Flye (Polia)', aliases = '{}'::text[] where id = '71701626-1f5c-5a7f-b36d-86a4f7251fe7'::uuid;
update public.exercises set name = 'Incline Inner Biceps Curl (Dumbbell)', name_en = 'Incline Inner Biceps Curl (Dumbbell)', name_pt = 'Inclinado Inner Biceps Curl (Halter)', aliases = '{}'::text[] where id = 'a18c80e3-1b6e-59a8-ab79-eb860718da82'::uuid;
update public.exercises set name = 'Incline Press (Dumbbell)', name_en = 'Incline Press (Dumbbell)', name_pt = 'Inclinado Press (Halter)', aliases = '{}'::text[] where id = '6df7b567-b05c-5c82-993a-5e7c775b7da9'::uuid;
update public.exercises set name = 'Incline Push Up (Bodyweight)', name_en = 'Incline Push Up (Bodyweight)', name_pt = 'Inclinado Push Up (Peso corporal)', aliases = '{}'::text[] where id = 'd2e8b06d-5ba5-58d1-9675-555ecabcf490'::uuid;
update public.exercises set name = 'Incline Push Up Close Grip (Bodyweight)', name_en = 'Incline Push Up Close Grip (Bodyweight)', name_pt = 'Inclinado Push Up Close Grip (Peso corporal)', aliases = '{}'::text[] where id = 'cc01c66f-eb80-5417-a278-df33a93cd9f4'::uuid;
update public.exercises set name = 'Incline Push Up Medium (Bodyweight)', name_en = 'Incline Push Up Medium (Bodyweight)', name_pt = 'Inclinado Push Up Medium (Peso corporal)', aliases = '{}'::text[] where id = '5a455516-87ec-52e7-8b0f-8f53d1c4a0d7'::uuid;
update public.exercises set name = 'Incline Push Up Reverse Grip (Bodyweight)', name_en = 'Incline Push Up Reverse Grip (Bodyweight)', name_pt = 'Inclinado Push Up Reverse Grip (Peso corporal)', aliases = '{}'::text[] where id = '2316b0f1-b18a-5b04-b59c-9cb352951776'::uuid;
update public.exercises set name = 'Incline Push Up Wide (Bodyweight)', name_en = 'Incline Push Up Wide (Bodyweight)', name_pt = 'Inclinado Push Up Wide (Peso corporal)', aliases = '{}'::text[] where id = '38d2fa44-bb89-5cb6-8684-87113728d816'::uuid;
update public.exercises set name = 'Incline Pushdown (Cable)', name_en = 'Incline Pushdown (Cable)', name_pt = 'Inclinado Pushdown (Polia)', aliases = '{}'::text[] where id = 'ceafebbf-84b7-57d9-91bf-e2f7c8f4eb02'::uuid;
update public.exercises set name = 'Incline Row (Dumbbell)', name_en = 'Incline Row (Dumbbell)', name_pt = 'Inclinado Row (Halter)', aliases = '{}'::text[] where id = '9f298903-a310-5407-b008-d2caf87dc602'::uuid;
update public.exercises set name = 'Incline Shoulder Raise (Barbell)', name_en = 'Incline Shoulder Raise (Barbell)', name_pt = 'Inclinado Shoulder Raise (Barra)', aliases = '{}'::text[] where id = '57dc19d4-cd2d-596c-aaa8-8fd279fcb2a0'::uuid;
update public.exercises set name = 'Incline Shoulder Raise (Dumbbell)', name_en = 'Incline Shoulder Raise (Dumbbell)', name_pt = 'Inclinado Shoulder Raise (Halter)', aliases = '{}'::text[] where id = '2219d6c0-c8e5-5f26-bc91-4dffe10be33d'::uuid;
update public.exercises set name = 'Incline Triceps Extension (Barbell)', name_en = 'Incline Triceps Extension (Barbell)', name_pt = 'Inclinado Triceps Extension (Barra)', aliases = '{}'::text[] where id = 'b27977a8-f580-509f-9ad6-4237fa34db4d'::uuid;
update public.exercises set name = 'Incline Triceps Extension (Cable)', name_en = 'Incline Triceps Extension (Cable)', name_pt = 'Inclinado Triceps Extension (Polia)', aliases = '{}'::text[] where id = '6638f60d-d9e4-5483-b99b-953a827588e7'::uuid;
update public.exercises set name = 'Lat Pulldown (Machine)', name_en = 'Lat Pulldown (Machine)', name_pt = 'Puxada Alta na Polia (Máquina)', aliases = ARRAY['Puxada Alta (Máquina)']::text[] where id = '1af96353-45a8-52b0-921e-a577c58cc9c5'::uuid;
update public.exercises set name = 'Leverage Decline Chest Press (Machine)', name_en = 'Leverage Decline Chest Press (Machine)', name_pt = 'Leverage Declinado Chest Press (Maquina)', aliases = '{}'::text[] where id = '94c6154d-c716-5679-a01e-71e4b73f20af'::uuid;
update public.exercises set name = 'Leverage Incline Chest Press (Machine)', name_en = 'Leverage Incline Chest Press (Machine)', name_pt = 'Leverage Inclinado Chest Press (Maquina)', aliases = '{}'::text[] where id = '15bac26d-feb1-53f5-9286-c55d659a9846'::uuid;
update public.exercises set name = 'Lying Cambered Row (Barbell)', name_en = 'Lying Cambered Row (Barbell)', name_pt = 'Deitado Cambered Row (Barra)', aliases = '{}'::text[] where id = 'ca2a8650-70fc-5dff-9e44-60d8c2255452'::uuid;
update public.exercises set name = 'Lying Close Grip Bar Curl On High Pulley (Cable)', name_en = 'Lying Close Grip Bar Curl On High Pulley (Cable)', name_pt = 'Deitado Close Grip Bar Curl On High Pulley (Polia)', aliases = '{}'::text[] where id = 'd1d2087d-1900-55e0-916a-2b1e60426f48'::uuid;
update public.exercises set name = 'Lying Close Grip Triceps Extension Behind The Head (Barbell)', name_en = 'Lying Close Grip Triceps Extension Behind The Head (Barbell)', name_pt = 'Deitado Close Grip Triceps Extension Behind The Head (Barra)', aliases = '{}'::text[] where id = '3e3aa63e-2ab1-50d9-82ad-4481389c89b4'::uuid;
update public.exercises set name = 'Lying Close Grip Triceps Press To Chin (Barbell)', name_en = 'Lying Close Grip Triceps Press To Chin (Barbell)', name_pt = 'Deitado Close Grip Triceps Press To Chin (Barra)', aliases = '{}'::text[] where id = 'df9d9809-e779-57f5-81dd-ec368a663813'::uuid;
update public.exercises set name = 'Lying Curl (Cable)', name_en = 'Lying Curl (Cable)', name_pt = 'Deitado Curl (Polia)', aliases = '{}'::text[] where id = 'c826217b-ceba-5e44-80c3-f7e9efe03386'::uuid;
update public.exercises set name = 'Lying High Bench Curl (Barbell)', name_en = 'Lying High Bench Curl (Barbell)', name_pt = 'Deitado High Bench Curl (Barra)', aliases = '{}'::text[] where id = '78878b74-007e-56e9-916f-4ec2e8e6eee2'::uuid;
update public.exercises set name = 'Lying One Arm Lateral Raise (Dumbbell)', name_en = 'Lying One Arm Lateral Raise (Dumbbell)', name_pt = 'Deitado Unilateral Elevacao Lateral (Halter)', aliases = '{}'::text[] where id = 'f29c9d69-8276-545f-9d4d-a68176125e31'::uuid;
update public.exercises set name = 'Lying One Arm Rear Lateral Raise (Dumbbell)', name_en = 'Lying One Arm Rear Lateral Raise (Dumbbell)', name_pt = 'Deitado Unilateral Rear Elevacao Lateral (Halter)', aliases = '{}'::text[] where id = '4ca53172-aaed-5980-b341-03977abaf747'::uuid;
update public.exercises set name = 'Lying Pronation (Dumbbell)', name_en = 'Lying Pronation (Dumbbell)', name_pt = 'Deitado Pronation (Halter)', aliases = '{}'::text[] where id = '14b24687-d596-547e-a4da-045bcb142d8e'::uuid;
update public.exercises set name = 'Lying Rear Delt Raise (Dumbbell)', name_en = 'Lying Rear Delt Raise (Dumbbell)', name_pt = 'Deitado Rear Delt Raise (Halter)', aliases = '{}'::text[] where id = '66bcdb47-3904-5c2b-8b43-69b18257e080'::uuid;
update public.exercises set name = 'Lying Rear Lateral Raise (Dumbbell)', name_en = 'Lying Rear Lateral Raise (Dumbbell)', name_pt = 'Deitado Rear Elevacao Lateral (Halter)', aliases = '{}'::text[] where id = '3c31cef5-0ceb-595e-9a6f-3369f1f27192'::uuid;
update public.exercises set name = 'Lying Squat (Machine)', name_en = 'Lying Squat (Machine)', name_pt = 'Deitado Squat (Maquina)', aliases = '{}'::text[] where id = 'a254778b-57f4-5972-9ef8-59941d1256e0'::uuid;
update public.exercises set name = 'Lying Supination (Dumbbell)', name_en = 'Lying Supination (Dumbbell)', name_pt = 'Deitado Supination (Halter)', aliases = '{}'::text[] where id = 'f36bb6d0-b4d7-5d9d-82f3-17b42464102d'::uuid;
update public.exercises set name = 'Lying Supine Curl (Dumbbell)', name_en = 'Lying Supine Curl (Dumbbell)', name_pt = 'Deitado Supine Curl (Halter)', aliases = '{}'::text[] where id = '6d12bc81-886f-551c-9b05-7ddfa3ce7352'::uuid;
update public.exercises set name = 'Lying T Bar Row (Machine)', name_en = 'Lying T Bar Row (Machine)', name_pt = 'Deitado Remada T-bar (Maquina)', aliases = '{}'::text[] where id = '18c72484-0ee5-5611-b3c0-88ba02bae022'::uuid;
update public.exercises set name = 'Lying Tricep Extension (Dumbbell)', name_en = 'Lying Tricep Extension (Dumbbell)', name_pt = 'Deitado Tricep Extension (Halter)', aliases = '{}'::text[] where id = '76892ea6-7a51-574d-9fd9-e5b496d0ecb2'::uuid;
update public.exercises set name = 'Lying Triceps Extension (Cable)', name_en = 'Lying Triceps Extension (Cable)', name_pt = 'Deitado Triceps Extension (Polia)', aliases = '{}'::text[] where id = '1b5d756a-00a4-553a-8187-6764d50d823c'::uuid;
update public.exercises set name = 'Lying Triceps Press (Barbell)', name_en = 'Lying Triceps Press (Barbell)', name_pt = 'Deitado Triceps Press (Barra)', aliases = '{}'::text[] where id = '69ec27da-104f-5ac2-8d3e-3bf78241f6db'::uuid;
update public.exercises set name = 'One Arm Bench Press (Dumbbell)', name_en = 'One Arm Bench Press (Dumbbell)', name_pt = 'Unilateral Supino (Halter)', aliases = '{}'::text[] where id = 'd6397766-5fa4-52c5-a1da-1f9b245a54c7'::uuid;
update public.exercises set name = 'One Arm Clean (Kettlebell)', name_en = 'One Arm Clean (Kettlebell)', name_pt = 'Unilateral Clean (Kettlebell)', aliases = '{}'::text[] where id = '90be1d67-49a2-5c2d-b798-fd12d90734e2'::uuid;
update public.exercises set name = 'One Arm Clean And Jerk (Kettlebell)', name_en = 'One Arm Clean And Jerk (Kettlebell)', name_pt = 'Unilateral Clean And Jerk (Kettlebell)', aliases = '{}'::text[] where id = 'acba49da-883e-5816-8592-0517180c3c78'::uuid;
update public.exercises set name = 'One Arm Flat Bench Flye (Dumbbell)', name_en = 'One Arm Flat Bench Flye (Dumbbell)', name_pt = 'Unilateral Flat Bench Flye (Halter)', aliases = '{}'::text[] where id = 'd9de8433-b754-5210-a48e-e58c0f97c7e0'::uuid;
update public.exercises set name = 'One Arm Floor Press (Barbell)', name_en = 'One Arm Floor Press (Barbell)', name_pt = 'Unilateral Floor Press (Barra)', aliases = '{}'::text[] where id = '029cef47-e0b6-5fbe-b15c-5db5ff8ec659'::uuid;
update public.exercises set name = 'One Arm Floor Press (Kettlebell)', name_en = 'One Arm Floor Press (Kettlebell)', name_pt = 'Unilateral Floor Press (Kettlebell)', aliases = '{}'::text[] where id = 'ff1b197e-8304-5c74-a51d-a1f33ebad6b4'::uuid;
update public.exercises set name = 'One Arm High Pulley Side Bends (Cable)', name_en = 'One Arm High Pulley Side Bends (Cable)', name_pt = 'Unilateral High Pulley Side Bends (Polia)', aliases = '{}'::text[] where id = '424a3415-2c90-58dc-891c-7570e1aed63f'::uuid;
update public.exercises set name = 'One Arm Incline Lateral Raise (Dumbbell)', name_en = 'One Arm Incline Lateral Raise (Dumbbell)', name_pt = 'Unilateral Inclinado Elevacao Lateral (Halter)', aliases = '{}'::text[] where id = '47ce8f8b-5d01-5d7d-8694-b82c10b6f835'::uuid;
update public.exercises set name = 'One Arm Jerk (Kettlebell)', name_en = 'One Arm Jerk (Kettlebell)', name_pt = 'Unilateral Jerk (Kettlebell)', aliases = '{}'::text[] where id = '253d8407-3baf-548a-b752-52578ca53cb1'::uuid;
update public.exercises set name = 'One Arm Lat Pulldown (Cable)', name_en = 'One Arm Lat Pulldown (Cable)', name_pt = 'Unilateral Puxada Alta (Polia)', aliases = '{}'::text[] where id = '06178616-04ce-5200-8f1f-d004aff581ea'::uuid;
update public.exercises set name = 'One Arm Long Bar Row (Barbell)', name_en = 'One Arm Long Bar Row (Barbell)', name_pt = 'Unilateral Long Bar Row (Barra)', aliases = '{}'::text[] where id = 'f474a0c7-9549-5062-b01f-eb9bfce40dff'::uuid;
update public.exercises set name = 'One Arm Military Press To The Side (Kettlebell)', name_en = 'One Arm Military Press To The Side (Kettlebell)', name_pt = 'Unilateral Military Press To The Side (Kettlebell)', aliases = '{}'::text[] where id = '7272cef1-8da7-5b1a-bc5d-ed631c5ce5f1'::uuid;
update public.exercises set name = 'One Arm Open Palm Clean (Kettlebell)', name_en = 'One Arm Open Palm Clean (Kettlebell)', name_pt = 'Unilateral Open Palm Clean (Kettlebell)', aliases = '{}'::text[] where id = 'fa976303-1bbd-59b3-a670-bd6e1e368b46'::uuid;
update public.exercises set name = 'One Arm Overhead Squats (Kettlebell)', name_en = 'One Arm Overhead Squats (Kettlebell)', name_pt = 'Unilateral Overhead Squats (Kettlebell)', aliases = '{}'::text[] where id = '8132ad4d-06f5-5ebf-9da7-71173de4af6c'::uuid;
update public.exercises set name = 'One Arm Para Press (Kettlebell)', name_en = 'One Arm Para Press (Kettlebell)', name_pt = 'Unilateral Para Press (Kettlebell)', aliases = '{}'::text[] where id = '54a3524e-f087-5026-a941-598d50b56778'::uuid;
update public.exercises set name = 'One Arm Pronated Triceps Extension (Dumbbell)', name_en = 'One Arm Pronated Triceps Extension (Dumbbell)', name_pt = 'Unilateral Pronated Triceps Extension (Halter)', aliases = '{}'::text[] where id = '764ac1c8-3e6b-5ab9-9847-3c371b666b99'::uuid;
update public.exercises set name = 'One Arm Push Press (Kettlebell)', name_en = 'One Arm Push Press (Kettlebell)', name_pt = 'Unilateral Push Press (Kettlebell)', aliases = '{}'::text[] where id = '59d9c0d4-455f-516a-b419-dfdfae163973'::uuid;
update public.exercises set name = 'One Arm Row (Dumbbell)', name_en = 'One Arm Row (Dumbbell)', name_pt = 'Unilateral Row (Halter)', aliases = '{}'::text[] where id = '0681c6a8-7a7a-560c-8536-88a17ab990eb'::uuid;
update public.exercises set name = 'One Arm Row (Kettlebell)', name_en = 'One Arm Row (Kettlebell)', name_pt = 'Unilateral Row (Kettlebell)', aliases = '{}'::text[] where id = 'a0ab962e-d4fd-5df6-b3cc-9664bf9983f4'::uuid;
update public.exercises set name = 'One Arm Shoulder Press (Dumbbell)', name_en = 'One Arm Shoulder Press (Dumbbell)', name_pt = 'Unilateral Desenvolvimento (Halter)', aliases = '{}'::text[] where id = '9a5ee006-10a2-5249-8941-94b9a3e1f8fc'::uuid;
update public.exercises set name = 'One Arm Side Deadlift (Barbell)', name_en = 'One Arm Side Deadlift (Barbell)', name_pt = 'Unilateral Side Deadlift (Barra)', aliases = '{}'::text[] where id = 'efe3c453-7f1c-591f-8546-3fa453455890'::uuid;
update public.exercises set name = 'One Arm Side Laterals (Dumbbell)', name_en = 'One Arm Side Laterals (Dumbbell)', name_pt = 'Unilateral Side Laterals (Halter)', aliases = '{}'::text[] where id = 'fa5204e4-4373-55bf-9b34-20ce2998dce1'::uuid;
update public.exercises set name = 'One Arm Snatch (Kettlebell)', name_en = 'One Arm Snatch (Kettlebell)', name_pt = 'Unilateral Snatch (Kettlebell)', aliases = '{}'::text[] where id = '9e923779-9f92-5ce4-ae89-321df3dc13ee'::uuid;
update public.exercises set name = 'One Arm Split Jerk (Kettlebell)', name_en = 'One Arm Split Jerk (Kettlebell)', name_pt = 'Unilateral Split Jerk (Kettlebell)', aliases = '{}'::text[] where id = 'bc155b4d-f3ef-5149-9bbe-37e1ffbb7abe'::uuid;
update public.exercises set name = 'One Arm Split Snatch (Kettlebell)', name_en = 'One Arm Split Snatch (Kettlebell)', name_pt = 'Unilateral Split Snatch (Kettlebell)', aliases = '{}'::text[] where id = '9805b014-ce80-5c04-ad64-28515c94dc76'::uuid;
update public.exercises set name = 'One Arm Supinated Triceps Extension (Dumbbell)', name_en = 'One Arm Supinated Triceps Extension (Dumbbell)', name_pt = 'Unilateral Supinated Triceps Extension (Halter)', aliases = '{}'::text[] where id = '548e6939-28ab-55cb-b91a-186018b649dc'::uuid;
update public.exercises set name = 'One Arm Swings (Kettlebell)', name_en = 'One Arm Swings (Kettlebell)', name_pt = 'Unilateral Swings (Kettlebell)', aliases = '{}'::text[] where id = 'f7e11de6-f883-5ba3-9181-1977522fb3d8'::uuid;
update public.exercises set name = 'One Arm Tricep Extension (Cable)', name_en = 'One Arm Tricep Extension (Cable)', name_pt = 'Unilateral Tricep Extension (Polia)', aliases = '{}'::text[] where id = '90f47b01-cae0-55c8-9725-0ded2f169b71'::uuid;
update public.exercises set name = 'One Arm Upright Row (Dumbbell)', name_en = 'One Arm Upright Row (Dumbbell)', name_pt = 'Unilateral Upright Row (Halter)', aliases = '{}'::text[] where id = '384e6df3-0206-522e-b917-17943c8e26f4'::uuid;
update public.exercises set name = 'Prone Incline Curl (Dumbbell)', name_en = 'Prone Incline Curl (Dumbbell)', name_pt = 'Prone Inclinado Curl (Halter)', aliases = '{}'::text[] where id = '56dea673-35b0-561f-a7d1-bff1cc038fd8'::uuid;
update public.exercises set name = 'Reverse Fly (Machine)', name_en = 'Reverse Fly (Machine)', name_pt = 'Reverse Crucifixo (Maquina)', aliases = ARRAY['Aberturas Invertidas De Ombro Posterior (Na Máquina)']::text[] where id = '8fe482e2-be61-55ef-a785-69ae6bebd9d2'::uuid;
update public.exercises set name = 'Reverse Grip Triceps Pushdown (Cable)', name_en = 'Reverse Grip Triceps Pushdown (Cable)', name_pt = 'Reverse Grip Extensao De Triceps (Polia)', aliases = '{}'::text[] where id = 'e15b61c3-9e6c-55f5-ae4f-31af9aaf7943'::uuid;
update public.exercises set name = 'Reverse Hyperextension (Machine)', name_en = 'Reverse Hyperextension (Machine)', name_pt = 'Reverse Hiperextensao (Maquina)', aliases = ARRAY['Hiperextensão Reversa']::text[] where id = '5362f975-cf8a-5714-a6ed-b09ae10545a9'::uuid;
update public.exercises set name = 'Rocking Standing Calf Raise (Barbell)', name_en = 'Rocking Standing Calf Raise (Barbell)', name_pt = 'Rocking Em Pe Elevacao De Panturrilha (Barra)', aliases = '{}'::text[] where id = '7cb4b9e8-45a8-5c72-a34a-2b133969f6be'::uuid;
update public.exercises set name = 'Seated Bent Over One Arm Triceps Extension (Dumbbell)', name_en = 'Seated Bent Over One Arm Triceps Extension (Dumbbell)', name_pt = 'Sentado Bent Over Unilateral Triceps Extension (Halter)', aliases = '{}'::text[] where id = '9c8f83b9-17b8-5931-bddf-46d9f3521cef'::uuid;
update public.exercises set name = 'Seated Bent Over Rear Delt Raise (Dumbbell)', name_en = 'Seated Bent Over Rear Delt Raise (Dumbbell)', name_pt = 'Sentado Bent Over Rear Delt Raise (Halter)', aliases = '{}'::text[] where id = '428de6fe-0cf7-5118-8357-51cdfe8accef'::uuid;
update public.exercises set name = 'Seated Bent Over Two Arm Triceps Extension (Dumbbell)', name_en = 'Seated Bent Over Two Arm Triceps Extension (Dumbbell)', name_pt = 'Sentado Bent Over Two Arm Triceps Extension (Halter)', aliases = '{}'::text[] where id = 'f6021ffd-ecd7-5985-a5cf-38656769acca'::uuid;
update public.exercises set name = 'Seated Calf Raise (Barbell)', name_en = 'Seated Calf Raise (Barbell)', name_pt = 'Sentado Elevacao De Panturrilha (Barra)', aliases = '{}'::text[] where id = 'c953f992-a551-5f66-8d49-6519a5ecd546'::uuid;
update public.exercises set name = 'Seated Calf Raise (Machine)', name_en = 'Seated Calf Raise (Machine)', name_pt = 'Sentado Elevacao De Panturrilha (Maquina)', aliases = '{}'::text[] where id = '8dd1e3f6-99d7-5c0d-b016-d293c02d39ca'::uuid;
update public.exercises set name = 'Seated Close Grip Concentration Curl (Barbell)', name_en = 'Seated Close Grip Concentration Curl (Barbell)', name_pt = 'Sentado Close Grip Concentration Curl (Barra)', aliases = '{}'::text[] where id = 'aa5787eb-1de8-5ba5-acd4-d4aa6e6e2c32'::uuid;
update public.exercises set name = 'Seated Crunch (Cable)', name_en = 'Seated Crunch (Cable)', name_pt = 'Sentado Crunch (Polia)', aliases = ARRAY['Cable Crunch (Rope)', 'Abdominal (Corda)', 'Crunch (Cable)', 'Abdominal (Polia)', 'Rope Crunch (Cable)', 'Rope Abdominal (Polia)', 'Seated Abdominal (Polia)']::text[] where id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid;
update public.exercises set name = 'Seated Curl (Dumbbell)', name_en = 'Seated Curl (Dumbbell)', name_pt = 'Sentado Curl (Halter)', aliases = '{}'::text[] where id = '04e910b1-3494-5744-a30f-498fb67ac697'::uuid;
update public.exercises set name = 'Seated Flat Bench Leg Pull In (Bodyweight)', name_en = 'Seated Flat Bench Leg Pull In (Bodyweight)', name_pt = 'Sentado Flat Bench Leg Pull In (Peso corporal)', aliases = ARRAY['Flat Bench Leg Pull In (Bodyweight)', 'Flat Bench Leg Pull In (Peso corporal)', 'Seated Flat Bench Leg Pull In (Peso corporal)']::text[] where id = 'e378d4ca-a889-5e9e-b579-5466e37c3f9e'::uuid;
update public.exercises set name = 'Seated Good Mornings (Barbell)', name_en = 'Seated Good Mornings (Barbell)', name_pt = 'Sentado Good Mornings (Barra)', aliases = '{}'::text[] where id = 'd86ea0fb-4d77-57ec-a45a-2240a810337b'::uuid;
update public.exercises set name = 'Seated Inner Biceps Curl (Dumbbell)', name_en = 'Seated Inner Biceps Curl (Dumbbell)', name_pt = 'Sentado Inner Biceps Curl (Halter)', aliases = '{}'::text[] where id = 'd0adff3e-4bf4-5f5a-a08c-ea4fe8d39aa7'::uuid;
update public.exercises set name = 'Seated Lateral Raise (Cable)', name_en = 'Seated Lateral Raise (Cable)', name_pt = 'Sentado Elevacao Lateral (Polia)', aliases = ARRAY['Lateral Raise (Cable)', 'Elevação Lateral (Cabo)', 'Seated Elevacao Lateral (Polia)']::text[] where id = 'bfcae318-1657-5d50-b11c-f58af4e54e50'::uuid;
update public.exercises set name = 'Seated Leg Curl (Machine)', name_en = 'Seated Leg Curl (Machine)', name_pt = 'Mesa Flexora Sentada (Maquina)', aliases = ARRAY['Cadeira Flexora (Máquina)']::text[] where id = '63c8b6cb-4d82-5b29-81f9-929a4a206d9f'::uuid;
update public.exercises set name = 'Seated Leg Tucks (Bodyweight)', name_en = 'Seated Leg Tucks (Bodyweight)', name_pt = 'Sentado Leg Tucks (Peso corporal)', aliases = '{}'::text[] where id = 'eebbe975-641e-51ad-b670-a143265430bb'::uuid;
update public.exercises set name = 'Seated Military Press (Barbell)', name_en = 'Seated Military Press (Barbell)', name_pt = 'Sentado Military Press (Barra)', aliases = '{}'::text[] where id = 'e16fc79a-d924-51bc-9bdd-08ffd1823755'::uuid;
update public.exercises set name = 'Seated One Arm Palms Down Wrist Curl (Dumbbell)', name_en = 'Seated One Arm Palms Down Wrist Curl (Dumbbell)', name_pt = 'Sentado Unilateral Palms Down Wrist Curl (Halter)', aliases = '{}'::text[] where id = '8c2df508-4155-5d88-ad4c-d5680eca9df7'::uuid;
update public.exercises set name = 'Seated One Arm Palms Up Wrist Curl (Dumbbell)', name_en = 'Seated One Arm Palms Up Wrist Curl (Dumbbell)', name_pt = 'Sentado Unilateral Palms Up Wrist Curl (Halter)', aliases = '{}'::text[] where id = '921524a7-b813-5e7a-adfc-75b3b4dc1f20'::uuid;
update public.exercises set name = 'Seated One Arm Pulley Rows (Cable)', name_en = 'Seated One Arm Pulley Rows (Cable)', name_pt = 'Sentado Unilateral Pulley Rows (Polia)', aliases = '{}'::text[] where id = '771bb517-c761-533e-9f4e-23038c1ce39b'::uuid;
update public.exercises set name = 'Seated One Leg Calf Raise (Dumbbell)', name_en = 'Seated One Leg Calf Raise (Dumbbell)', name_pt = 'Sentado One Leg Elevacao De Panturrilha (Halter)', aliases = '{}'::text[] where id = '2eb43b82-abb0-51a7-a69d-a7ef0f3e6cbb'::uuid;
update public.exercises set name = 'Seated Palm Up Wrist Curl (Barbell)', name_en = 'Seated Palm Up Wrist Curl (Barbell)', name_pt = 'Sentado Palm Up Wrist Curl (Barra)', aliases = '{}'::text[] where id = 'ff80cf72-1796-5804-b353-f283a370402f'::uuid;
update public.exercises set name = 'Seated Palms Down Wrist Curl (Barbell)', name_en = 'Seated Palms Down Wrist Curl (Barbell)', name_pt = 'Sentado Palms Down Wrist Curl (Barra)', aliases = '{}'::text[] where id = '6dc922fc-03c5-5e44-aece-14c9962a765d'::uuid;
update public.exercises set name = 'Seated Palms Down Wrist Curl (Dumbbell)', name_en = 'Seated Palms Down Wrist Curl (Dumbbell)', name_pt = 'Sentado Palms Down Wrist Curl (Halter)', aliases = '{}'::text[] where id = 'e39850f5-1ebb-5f33-aa40-2ad07780dbdd'::uuid;
update public.exercises set name = 'Seated Palms Up Wrist Curl (Dumbbell)', name_en = 'Seated Palms Up Wrist Curl (Dumbbell)', name_pt = 'Sentado Palms Up Wrist Curl (Halter)', aliases = '{}'::text[] where id = 'f0570d10-89f2-54a1-b16f-3c30ca901cad'::uuid;
update public.exercises set name = 'Seated Press (Dumbbell)', name_en = 'Seated Press (Dumbbell)', name_pt = 'Sentado Press (Halter)', aliases = '{}'::text[] where id = '26feacb3-0a14-52ba-bdd2-73274815d3e8'::uuid;
update public.exercises set name = 'Seated Press (Kettlebell)', name_en = 'Seated Press (Kettlebell)', name_pt = 'Sentado Press (Kettlebell)', aliases = '{}'::text[] where id = '69cda355-dc10-5295-81a0-185c68c6cdd4'::uuid;
update public.exercises set name = 'Seated Shoulder Press (Cable)', name_en = 'Seated Shoulder Press (Cable)', name_pt = 'Desenvolvimento Sentado (Polia)', aliases = ARRAY['Shoulder Press (Cable)', 'Desenvolvimento (Polia)', 'Seated Desenvolvimento (Polia)']::text[] where id = '771748a5-0860-5a93-95f2-6fac9ef1a913'::uuid;
update public.exercises set name = 'Seated Shoulder Press (Dumbbell)', name_en = 'Seated Shoulder Press (Dumbbell)', name_pt = 'Press De Ombros (Sentada) (Halter)', aliases = ARRAY['Shoulder Press (Dumbbell)', 'Desenvolvimento (Halter)']::text[] where id = 'af013174-cb4c-5c5f-8a7a-21b489201e33'::uuid;
update public.exercises set name = 'Seated Side Lateral Raise (Dumbbell)', name_en = 'Seated Side Lateral Raise (Dumbbell)', name_pt = 'Sentado Elevacao Lateral (Halter)', aliases = ARRAY['Side Lateral Raise (Dumbbell)', 'Elevacao Lateral (Halter)', 'Seated Elevacao Lateral (Halter)']::text[] where id = 'f976b159-1ba2-56e7-a0c7-d5da1f6d5f21'::uuid;
update public.exercises set name = 'Seated Triceps Press (Dumbbell)', name_en = 'Seated Triceps Press (Dumbbell)', name_pt = 'Sentado Triceps Press (Halter)', aliases = '{}'::text[] where id = '0d62c362-5d4a-5d84-b784-a5c0d5d3407c'::uuid;
update public.exercises set name = 'Seated Twist (Barbell)', name_en = 'Seated Twist (Barbell)', name_pt = 'Sentado Twist (Barra)', aliases = '{}'::text[] where id = '447b69e4-24c2-5e1d-b818-71e0a446efef'::uuid;
update public.exercises set name = 'Seated Two Arm Palms Up Low Pulley Wrist Curl (Cable)', name_en = 'Seated Two Arm Palms Up Low Pulley Wrist Curl (Cable)', name_pt = 'Sentado Two Arm Palms Up Low Pulley Wrist Curl (Polia)', aliases = '{}'::text[] where id = 'afd9b082-6472-5e32-8126-e3d7592664cd'::uuid;
update public.exercises set name = 'Smith Close Grip Bench Press (Machine)', name_en = 'Smith Close Grip Bench Press (Machine)', name_pt = 'Smith Close Grip Supino (Maquina)', aliases = '{}'::text[] where id = '36d09da6-67a3-5ef0-8a0e-7710891a1fa6'::uuid;
update public.exercises set name = 'Smith Decline Press (Machine)', name_en = 'Smith Decline Press (Machine)', name_pt = 'Smith Declinado Press (Maquina)', aliases = '{}'::text[] where id = 'f79cb9e2-8c80-5b88-8b18-c533e8d6fe98'::uuid;
update public.exercises set name = 'Smith Incline Shoulder Raise (Barbell)', name_en = 'Smith Incline Shoulder Raise (Barbell)', name_pt = 'Smith Inclinado Shoulder Raise (Barra)', aliases = '{}'::text[] where id = '7d9ff5cd-8e41-51da-82a2-5e07fdaf2faf'::uuid;
update public.exercises set name = 'Smith One Arm Upright Row (Machine)', name_en = 'Smith One Arm Upright Row (Machine)', name_pt = 'Smith Unilateral Upright Row (Maquina)', aliases = '{}'::text[] where id = '8682199e-546e-5308-821f-681de7cc5f4b'::uuid;
update public.exercises set name = 'Standing Alternating Press (Dumbbell)', name_en = 'Standing Alternating Press (Dumbbell)', name_pt = 'Em Pe Alternating Press (Halter)', aliases = '{}'::text[] where id = '15253e8e-0973-5f99-9cfa-9635548cd6e8'::uuid;
update public.exercises set name = 'Standing Bent Over One Arm Triceps Extension (Dumbbell)', name_en = 'Standing Bent Over One Arm Triceps Extension (Dumbbell)', name_pt = 'Em Pe Bent Over Unilateral Triceps Extension (Halter)', aliases = '{}'::text[] where id = 'da98db7b-ae76-534d-82f4-3016e462ef6d'::uuid;
update public.exercises set name = 'Standing Bent Over Two Arm Triceps Extension (Dumbbell)', name_en = 'Standing Bent Over Two Arm Triceps Extension (Dumbbell)', name_pt = 'Em Pe Bent Over Two Arm Triceps Extension (Halter)', aliases = '{}'::text[] where id = 'ed128608-e82b-53e0-976e-fd91d83eb342'::uuid;
update public.exercises set name = 'Standing Biceps Curl (Cable)', name_en = 'Standing Biceps Curl (Cable)', name_pt = 'Em Pe Biceps Curl (Polia)', aliases = '{}'::text[] where id = '266d144b-f9d1-5dcd-89d4-3e17a944bc9f'::uuid;
update public.exercises set name = 'Standing Bradford Press (Barbell)', name_en = 'Standing Bradford Press (Barbell)', name_pt = 'Em Pe Bradford Press (Barra)', aliases = '{}'::text[] where id = '446ad6ef-de00-5f11-ba08-6a13d946daef'::uuid;
update public.exercises set name = 'Standing Calf Raise (Barbell)', name_en = 'Standing Calf Raise (Barbell)', name_pt = 'Em Pe Elevacao De Panturrilha (Barra)', aliases = '{}'::text[] where id = 'e8b9396d-45f9-551b-96b8-aed7b611df36'::uuid;
update public.exercises set name = 'Standing Calf Raise (Dumbbell)', name_en = 'Standing Calf Raise (Dumbbell)', name_pt = 'Em Pe Elevacao De Panturrilha (Halter)', aliases = '{}'::text[] where id = '04547b45-7524-5342-8b3e-dc73400622df'::uuid;
update public.exercises set name = 'Standing Calf Raise (Machine)', name_en = 'Standing Calf Raise (Machine)', name_pt = 'Em Pe Elevacao De Panturrilha (Maquina)', aliases = ARRAY['Elevação de Panturrilha em Pé (Máquina)', 'Standing Elevacao De Gemeos (Maquina)']::text[] where id = '9a2d7237-8eb2-501e-9a0d-d6309a07fd08'::uuid;
update public.exercises set name = 'Standing Chest Press (Cable)', name_en = 'Standing Chest Press (Cable)', name_pt = 'Em Pe Chest Press (Polia)', aliases = ARRAY['Chest Press (Cable)', 'Chest Press (Polia)', 'Standing Chest Press (Polia)']::text[] where id = '51edb808-67eb-51c5-89dd-a20149d53720'::uuid;
update public.exercises set name = 'Standing Concentration Curl (Dumbbell)', name_en = 'Standing Concentration Curl (Dumbbell)', name_pt = 'Em Pe Concentration Curl (Halter)', aliases = ARRAY['Concentration Curl (Dumbbell)', 'Rosca Concentrada (Halter)', 'Standing Rosca Concentrada (Halter)']::text[] where id = '6307c320-6581-59e7-a50f-b81c0303b42c'::uuid;
update public.exercises set name = 'Standing Front Raise Over Head (Barbell)', name_en = 'Standing Front Raise Over Head (Barbell)', name_pt = 'Em Pe Elevacao Frontal Over Head (Barra)', aliases = '{}'::text[] where id = 'c8c6b8f6-d2e9-5731-b6cc-6e96681fcac0'::uuid;
update public.exercises set name = 'Standing Inner Biceps Curl (Dumbbell)', name_en = 'Standing Inner Biceps Curl (Dumbbell)', name_pt = 'Em Pe Inner Biceps Curl (Halter)', aliases = '{}'::text[] where id = '8ff9bd27-c5e2-5eba-8c1c-1750cc072f89'::uuid;
update public.exercises set name = 'Standing Leg Curl (Machine)', name_en = 'Standing Leg Curl (Machine)', name_pt = 'Mesa Flexora em Pe (Maquina)', aliases = ARRAY['Flexão de Pernas em Pé']::text[] where id = 'b0330be7-e911-592f-ba1c-bcadec0ec14f'::uuid;
update public.exercises set name = 'Standing Lift (Cable)', name_en = 'Standing Lift (Cable)', name_pt = 'Em Pe Lift (Polia)', aliases = '{}'::text[] where id = 'b56a6a12-d207-5452-bd87-1a4db05a5ac7'::uuid;
update public.exercises set name = 'Standing Low Pulley Deltoid Raise (Cable)', name_en = 'Standing Low Pulley Deltoid Raise (Cable)', name_pt = 'Em Pe Low Pulley Deltoid Raise (Polia)', aliases = '{}'::text[] where id = 'b9e9ed0c-6056-5ded-846e-e68956484db2'::uuid;
update public.exercises set name = 'Standing Low Pulley One Arm Triceps Extension (Cable)', name_en = 'Standing Low Pulley One Arm Triceps Extension (Cable)', name_pt = 'Em Pe Low Pulley Unilateral Triceps Extension (Polia)', aliases = '{}'::text[] where id = 'a6304ddb-f529-585c-b28c-760765ce3824'::uuid;
update public.exercises set name = 'Standing Military Press (Barbell)', name_en = 'Standing Military Press (Barbell)', name_pt = 'Em Pe Military Press (Barra)', aliases = '{}'::text[] where id = '6441c2f2-0d83-5277-bb4a-1aa791898815'::uuid;
update public.exercises set name = 'Standing One Arm Curl (Cable)', name_en = 'Standing One Arm Curl (Cable)', name_pt = 'Em Pe Unilateral Curl (Polia)', aliases = '{}'::text[] where id = 'b14e046a-b020-5be1-9dd4-b9c37a0bb050'::uuid;
update public.exercises set name = 'Standing One Arm Curl Over Incline Bench (Dumbbell)', name_en = 'Standing One Arm Curl Over Incline Bench (Dumbbell)', name_pt = 'Em Pe Unilateral Curl Over Inclinado Bench (Halter)', aliases = '{}'::text[] where id = '6189ca02-8fc7-5171-baad-0db6250ba366'::uuid;
update public.exercises set name = 'Standing One Arm Triceps Extension (Dumbbell)', name_en = 'Standing One Arm Triceps Extension (Dumbbell)', name_pt = 'Em Pe Unilateral Triceps Extension (Halter)', aliases = ARRAY['One Arm Triceps Extension (Dumbbell)', 'One Arm Triceps Extensao (Halter)', 'Standing One Arm Triceps Extensao (Halter)']::text[] where id = '1dd8cde1-d1cb-58ec-83e1-c267128e8da3'::uuid;
update public.exercises set name = 'Standing Overhead Triceps Extension (Barbell)', name_en = 'Standing Overhead Triceps Extension (Barbell)', name_pt = 'Em Pe Overhead Triceps Extension (Barra)', aliases = '{}'::text[] where id = '4153faea-29e8-5b6d-8ee3-bc1c56cf0b2e'::uuid;
update public.exercises set name = 'Standing Palm In One Arm Press (Dumbbell)', name_en = 'Standing Palm In One Arm Press (Dumbbell)', name_pt = 'Em Pe Palm In Unilateral Press (Halter)', aliases = '{}'::text[] where id = '2cb8e67e-69bc-524d-b560-f0a2cca9f904'::uuid;
update public.exercises set name = 'Standing Palms In Press (Dumbbell)', name_en = 'Standing Palms In Press (Dumbbell)', name_pt = 'Em Pe Palms In Press (Halter)', aliases = '{}'::text[] where id = 'bdffe845-7352-500d-aadf-9a28ff5c67d9'::uuid;
update public.exercises set name = 'Standing Palms Up Behind The Back Wrist Curl (Barbell)', name_en = 'Standing Palms Up Behind The Back Wrist Curl (Barbell)', name_pt = 'Em Pe Palms Up Behind The Back Wrist Curl (Barra)', aliases = '{}'::text[] where id = 'bf5cc5dd-79cd-53a9-9ea1-c55c79ecaede'::uuid;
update public.exercises set name = 'Standing Press (Dumbbell)', name_en = 'Standing Press (Dumbbell)', name_pt = 'Em Pe Press (Halter)', aliases = '{}'::text[] where id = '079fa475-c04a-51c0-9d45-da8342e92568'::uuid;
update public.exercises set name = 'Standing Press Behind Neck (Barbell)', name_en = 'Standing Press Behind Neck (Barbell)', name_pt = 'Em Pe Press Behind Neck (Barra)', aliases = '{}'::text[] where id = '2a094166-7d0a-5845-b87d-60eba3e88d6a'::uuid;
update public.exercises set name = 'Standing Reverse Curl (Dumbbell)', name_en = 'Standing Reverse Curl (Dumbbell)', name_pt = 'Em Pe Reverse Curl (Halter)', aliases = '{}'::text[] where id = '85ef4a45-5974-5c98-9fd5-0d942279d688'::uuid;
update public.exercises set name = 'Standing Rope Crunch (Cable)', name_en = 'Standing Rope Crunch (Cable)', name_pt = 'Em Pe Rope Crunch (Polia)', aliases = '{}'::text[] where id = '12ed9103-b16a-5c49-8371-5eb3356794ec'::uuid;
update public.exercises set name = 'Standing Straight Arm Front Delt Raise Above Head (Dumbbell)', name_en = 'Standing Straight Arm Front Delt Raise Above Head (Dumbbell)', name_pt = 'Em Pe Straight Arm Front Delt Raise Above Head (Halter)', aliases = '{}'::text[] where id = 'c5ca7acd-c33a-55dd-b5c2-ecd6d6ffe6ef'::uuid;
update public.exercises set name = 'Standing Towel Triceps Extension (Bodyweight)', name_en = 'Standing Towel Triceps Extension (Bodyweight)', name_pt = 'Em Pe Towel Triceps Extension (Peso corporal)', aliases = '{}'::text[] where id = 'a3931ec0-c3a4-576e-916c-20da9ff7e210'::uuid;
update public.exercises set name = 'Standing Triceps Extension (Dumbbell)', name_en = 'Standing Triceps Extension (Dumbbell)', name_pt = 'Em Pe Triceps Extension (Halter)', aliases = '{}'::text[] where id = 'e8198ba6-af01-5e95-87a2-c3fe97b622ac'::uuid;
update public.exercises set name = 'Standing Upright Row (Dumbbell)', name_en = 'Standing Upright Row (Dumbbell)', name_pt = 'Em Pe Upright Row (Halter)', aliases = '{}'::text[] where id = '362e268d-eb59-576e-9e55-e4476c1500b3'::uuid;
update public.exercises set name = 'Standing Wood Chop (Cable)', name_en = 'Standing Wood Chop (Cable)', name_pt = 'Em Pe Wood Chop (Polia)', aliases = '{}'::text[] where id = 'faa611b9-0dac-5e38-8e39-fcf9043f35d9'::uuid;
update public.exercises set name = 'Straight Raise On Incline Bench (Barbell)', name_en = 'Straight Raise On Incline Bench (Barbell)', name_pt = 'Straight Raise On Inclinado Bench (Barra)', aliases = '{}'::text[] where id = '6e50ff7a-7971-5945-8599-fa0a57b46c0c'::uuid;
update public.exercises set name = 'T Bar Row With Handle (Barbell)', name_en = 'T Bar Row With Handle (Barbell)', name_pt = 'Remada T-bar With Handle (Barra)', aliases = '{}'::text[] where id = '0b4fb77f-4ddd-5a57-9fbe-015f7b11435b'::uuid;
update public.exercises set name = 'Thigh Adductor (Machine)', name_en = 'Thigh Adductor (Machine)', name_pt = 'Thigh Adductor (Maquina)', aliases = ARRAY['Cadeira Adutora (Máquina)']::text[] where id = 'b86c7e38-53ba-5294-a2f6-66c9343bc8fc'::uuid;
update public.exercises set name = 'Triceps Pushdown (Cable)', name_en = 'Triceps Pushdown (Cable)', name_pt = 'Pushdown De Triceps (Polia)', aliases = ARRAY['Tríceps na Polia']::text[] where id = '0e01567c-ddc3-5ec8-bf40-7850e1f53264'::uuid;
update public.exercises set name = 'Wide Grip Bench Press (Barbell)', name_en = 'Wide Grip Bench Press (Barbell)', name_pt = 'Wide Grip Supino (Barra)', aliases = '{}'::text[] where id = '456b25d8-7e5e-5ec0-841b-3b743afbcc8a'::uuid;
update public.exercises set name = 'Wide Grip Decline Bench Press (Barbell)', name_en = 'Wide Grip Decline Bench Press (Barbell)', name_pt = 'Wide Grip Supino Declinado (Barra)', aliases = '{}'::text[] where id = '03173cdd-da56-58d9-8ba0-d33022993147'::uuid;
update public.exercises set name = 'Wide Grip Decline Pullover (Barbell)', name_en = 'Wide Grip Decline Pullover (Barbell)', name_pt = 'Wide Grip Declinado Pullover (Barra)', aliases = '{}'::text[] where id = '9fb075d6-dab2-51d3-b674-0784c833f6f4'::uuid;
update public.exercises set name = 'Wide Grip Lat Pulldown (Cable)', name_en = 'Wide Grip Lat Pulldown (Cable)', name_pt = 'Wide Grip Puxada Alta (Polia)', aliases = '{}'::text[] where id = 'bdf1aea2-265d-5e9e-9abd-9c44ff2144d3'::uuid;
update public.exercises set name = 'Wide Grip Standing Curl (Barbell)', name_en = 'Wide Grip Standing Curl (Barbell)', name_pt = 'Wide Grip Em Pe Curl (Barra)', aliases = '{}'::text[] where id = '61814487-eb41-5798-a997-4094889fbc1b'::uuid;
-- generic→seated/standing (cable::crunch)
update public.sets set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '58376161-90e2-5a4f-8c44-9d90d601725f'::uuid;
update public.workout_exercises set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '58376161-90e2-5a4f-8c44-9d90d601725f'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '58376161-90e2-5a4f-8c44-9d90d601725f'::uuid;
update public.template_exercises set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '58376161-90e2-5a4f-8c44-9d90d601725f'::uuid;
update public.routine_exercises set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '58376161-90e2-5a4f-8c44-9d90d601725f'::uuid;
delete from public.exercises where id = '58376161-90e2-5a4f-8c44-9d90d601725f'::uuid;
-- generic→seated/standing (cable::crunch)
update public.sets set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '2eafe449-d6d4-5baa-9507-d3c88a53fbf5'::uuid;
update public.workout_exercises set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '2eafe449-d6d4-5baa-9507-d3c88a53fbf5'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '2eafe449-d6d4-5baa-9507-d3c88a53fbf5'::uuid;
update public.template_exercises set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '2eafe449-d6d4-5baa-9507-d3c88a53fbf5'::uuid;
update public.routine_exercises set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '2eafe449-d6d4-5baa-9507-d3c88a53fbf5'::uuid;
delete from public.exercises where id = '2eafe449-d6d4-5baa-9507-d3c88a53fbf5'::uuid;
-- generic→seated/standing (cable::crunch)
update public.sets set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '2ef0cbc1-a978-5dda-8300-f925f06738ed'::uuid;
update public.workout_exercises set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '2ef0cbc1-a978-5dda-8300-f925f06738ed'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '2ef0cbc1-a978-5dda-8300-f925f06738ed'::uuid;
update public.template_exercises set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '2ef0cbc1-a978-5dda-8300-f925f06738ed'::uuid;
update public.routine_exercises set exercise_id = '34d540ff-b121-5398-8de5-ee32ac59d9e5'::uuid where exercise_id = '2ef0cbc1-a978-5dda-8300-f925f06738ed'::uuid;
delete from public.exercises where id = '2ef0cbc1-a978-5dda-8300-f925f06738ed'::uuid;
-- generic→seated/standing (cable::chest press)
update public.sets set exercise_id = '51edb808-67eb-51c5-89dd-a20149d53720'::uuid where exercise_id = 'd1ef498d-3ffc-5c87-a816-6f4625038ecb'::uuid;
update public.workout_exercises set exercise_id = '51edb808-67eb-51c5-89dd-a20149d53720'::uuid where exercise_id = 'd1ef498d-3ffc-5c87-a816-6f4625038ecb'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '51edb808-67eb-51c5-89dd-a20149d53720'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = 'd1ef498d-3ffc-5c87-a816-6f4625038ecb'::uuid;
update public.template_exercises set exercise_id = '51edb808-67eb-51c5-89dd-a20149d53720'::uuid where exercise_id = 'd1ef498d-3ffc-5c87-a816-6f4625038ecb'::uuid;
update public.routine_exercises set exercise_id = '51edb808-67eb-51c5-89dd-a20149d53720'::uuid where exercise_id = 'd1ef498d-3ffc-5c87-a816-6f4625038ecb'::uuid;
delete from public.exercises where id = 'd1ef498d-3ffc-5c87-a816-6f4625038ecb'::uuid;
-- generic→seated/standing (barbell::close curl grip)
update public.sets set exercise_id = '12f47577-1b98-5fc3-8a63-e399a3f6af16'::uuid where exercise_id = 'f66a8778-cf8c-5ba0-bd27-977868e4914d'::uuid;
update public.workout_exercises set exercise_id = '12f47577-1b98-5fc3-8a63-e399a3f6af16'::uuid where exercise_id = 'f66a8778-cf8c-5ba0-bd27-977868e4914d'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '12f47577-1b98-5fc3-8a63-e399a3f6af16'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = 'f66a8778-cf8c-5ba0-bd27-977868e4914d'::uuid;
update public.template_exercises set exercise_id = '12f47577-1b98-5fc3-8a63-e399a3f6af16'::uuid where exercise_id = 'f66a8778-cf8c-5ba0-bd27-977868e4914d'::uuid;
update public.routine_exercises set exercise_id = '12f47577-1b98-5fc3-8a63-e399a3f6af16'::uuid where exercise_id = 'f66a8778-cf8c-5ba0-bd27-977868e4914d'::uuid;
delete from public.exercises where id = 'f66a8778-cf8c-5ba0-bd27-977868e4914d'::uuid;
-- generic→seated/standing (barbell::close curl grip)
update public.sets set exercise_id = '12f47577-1b98-5fc3-8a63-e399a3f6af16'::uuid where exercise_id = 'b5235b8d-3c48-526f-9d1a-4470be3fa6f0'::uuid;
update public.workout_exercises set exercise_id = '12f47577-1b98-5fc3-8a63-e399a3f6af16'::uuid where exercise_id = 'b5235b8d-3c48-526f-9d1a-4470be3fa6f0'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '12f47577-1b98-5fc3-8a63-e399a3f6af16'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = 'b5235b8d-3c48-526f-9d1a-4470be3fa6f0'::uuid;
update public.template_exercises set exercise_id = '12f47577-1b98-5fc3-8a63-e399a3f6af16'::uuid where exercise_id = 'b5235b8d-3c48-526f-9d1a-4470be3fa6f0'::uuid;
update public.routine_exercises set exercise_id = '12f47577-1b98-5fc3-8a63-e399a3f6af16'::uuid where exercise_id = 'b5235b8d-3c48-526f-9d1a-4470be3fa6f0'::uuid;
delete from public.exercises where id = 'b5235b8d-3c48-526f-9d1a-4470be3fa6f0'::uuid;
-- generic→seated/standing (dumbbell::concentration curl)
update public.sets set exercise_id = '6307c320-6581-59e7-a50f-b81c0303b42c'::uuid where exercise_id = '264a6657-5d59-579c-a65d-a3b24a983c8a'::uuid;
update public.workout_exercises set exercise_id = '6307c320-6581-59e7-a50f-b81c0303b42c'::uuid where exercise_id = '264a6657-5d59-579c-a65d-a3b24a983c8a'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '6307c320-6581-59e7-a50f-b81c0303b42c'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '264a6657-5d59-579c-a65d-a3b24a983c8a'::uuid;
update public.template_exercises set exercise_id = '6307c320-6581-59e7-a50f-b81c0303b42c'::uuid where exercise_id = '264a6657-5d59-579c-a65d-a3b24a983c8a'::uuid;
update public.routine_exercises set exercise_id = '6307c320-6581-59e7-a50f-b81c0303b42c'::uuid where exercise_id = '264a6657-5d59-579c-a65d-a3b24a983c8a'::uuid;
delete from public.exercises where id = '264a6657-5d59-579c-a65d-a3b24a983c8a'::uuid;
-- generic→seated/standing (bodyweight::bench flat in leg pull)
update public.sets set exercise_id = 'e378d4ca-a889-5e9e-b579-5466e37c3f9e'::uuid where exercise_id = 'ef6b5eee-6a99-58e6-87ae-30c6bae52ce0'::uuid;
update public.workout_exercises set exercise_id = 'e378d4ca-a889-5e9e-b579-5466e37c3f9e'::uuid where exercise_id = 'ef6b5eee-6a99-58e6-87ae-30c6bae52ce0'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = 'e378d4ca-a889-5e9e-b579-5466e37c3f9e'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = 'ef6b5eee-6a99-58e6-87ae-30c6bae52ce0'::uuid;
update public.template_exercises set exercise_id = 'e378d4ca-a889-5e9e-b579-5466e37c3f9e'::uuid where exercise_id = 'ef6b5eee-6a99-58e6-87ae-30c6bae52ce0'::uuid;
update public.routine_exercises set exercise_id = 'e378d4ca-a889-5e9e-b579-5466e37c3f9e'::uuid where exercise_id = 'ef6b5eee-6a99-58e6-87ae-30c6bae52ce0'::uuid;
delete from public.exercises where id = 'ef6b5eee-6a99-58e6-87ae-30c6bae52ce0'::uuid;
-- generic→seated/standing (cable::lateral raise)
update public.sets set exercise_id = 'bfcae318-1657-5d50-b11c-f58af4e54e50'::uuid where exercise_id = '2056704c-8210-5e30-8858-39803a01d0fd'::uuid;
update public.workout_exercises set exercise_id = 'bfcae318-1657-5d50-b11c-f58af4e54e50'::uuid where exercise_id = '2056704c-8210-5e30-8858-39803a01d0fd'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = 'bfcae318-1657-5d50-b11c-f58af4e54e50'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '2056704c-8210-5e30-8858-39803a01d0fd'::uuid;
update public.template_exercises set exercise_id = 'bfcae318-1657-5d50-b11c-f58af4e54e50'::uuid where exercise_id = '2056704c-8210-5e30-8858-39803a01d0fd'::uuid;
update public.routine_exercises set exercise_id = 'bfcae318-1657-5d50-b11c-f58af4e54e50'::uuid where exercise_id = '2056704c-8210-5e30-8858-39803a01d0fd'::uuid;
delete from public.exercises where id = '2056704c-8210-5e30-8858-39803a01d0fd'::uuid;
-- generic→seated/standing (dumbbell::arm extension one triceps)
update public.sets set exercise_id = '1dd8cde1-d1cb-58ec-83e1-c267128e8da3'::uuid where exercise_id = 'bd3ea714-cdc5-5e69-9fb4-94e184dadcb8'::uuid;
update public.workout_exercises set exercise_id = '1dd8cde1-d1cb-58ec-83e1-c267128e8da3'::uuid where exercise_id = 'bd3ea714-cdc5-5e69-9fb4-94e184dadcb8'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '1dd8cde1-d1cb-58ec-83e1-c267128e8da3'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = 'bd3ea714-cdc5-5e69-9fb4-94e184dadcb8'::uuid;
update public.template_exercises set exercise_id = '1dd8cde1-d1cb-58ec-83e1-c267128e8da3'::uuid where exercise_id = 'bd3ea714-cdc5-5e69-9fb4-94e184dadcb8'::uuid;
update public.routine_exercises set exercise_id = '1dd8cde1-d1cb-58ec-83e1-c267128e8da3'::uuid where exercise_id = 'bd3ea714-cdc5-5e69-9fb4-94e184dadcb8'::uuid;
delete from public.exercises where id = 'bd3ea714-cdc5-5e69-9fb4-94e184dadcb8'::uuid;
-- generic→seated/standing (cable::press shoulder)
update public.sets set exercise_id = '771748a5-0860-5a93-95f2-6fac9ef1a913'::uuid where exercise_id = 'f76c7fc7-3378-5d5e-b990-a34c836a5f97'::uuid;
update public.workout_exercises set exercise_id = '771748a5-0860-5a93-95f2-6fac9ef1a913'::uuid where exercise_id = 'f76c7fc7-3378-5d5e-b990-a34c836a5f97'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '771748a5-0860-5a93-95f2-6fac9ef1a913'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = 'f76c7fc7-3378-5d5e-b990-a34c836a5f97'::uuid;
update public.template_exercises set exercise_id = '771748a5-0860-5a93-95f2-6fac9ef1a913'::uuid where exercise_id = 'f76c7fc7-3378-5d5e-b990-a34c836a5f97'::uuid;
update public.routine_exercises set exercise_id = '771748a5-0860-5a93-95f2-6fac9ef1a913'::uuid where exercise_id = 'f76c7fc7-3378-5d5e-b990-a34c836a5f97'::uuid;
delete from public.exercises where id = 'f76c7fc7-3378-5d5e-b990-a34c836a5f97'::uuid;
-- generic→seated/standing (dumbbell::press shoulder)
update public.sets set exercise_id = 'af013174-cb4c-5c5f-8a7a-21b489201e33'::uuid where exercise_id = '19f7dd52-b2fa-51a1-b037-2d7a146b9e56'::uuid;
update public.workout_exercises set exercise_id = 'af013174-cb4c-5c5f-8a7a-21b489201e33'::uuid where exercise_id = '19f7dd52-b2fa-51a1-b037-2d7a146b9e56'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = 'af013174-cb4c-5c5f-8a7a-21b489201e33'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '19f7dd52-b2fa-51a1-b037-2d7a146b9e56'::uuid;
update public.template_exercises set exercise_id = 'af013174-cb4c-5c5f-8a7a-21b489201e33'::uuid where exercise_id = '19f7dd52-b2fa-51a1-b037-2d7a146b9e56'::uuid;
update public.routine_exercises set exercise_id = 'af013174-cb4c-5c5f-8a7a-21b489201e33'::uuid where exercise_id = '19f7dd52-b2fa-51a1-b037-2d7a146b9e56'::uuid;
delete from public.exercises where id = '19f7dd52-b2fa-51a1-b037-2d7a146b9e56'::uuid;
-- generic→seated/standing (dumbbell::lateral raise side)
update public.sets set exercise_id = 'f976b159-1ba2-56e7-a0c7-d5da1f6d5f21'::uuid where exercise_id = '1dcd1a31-ec4a-5d56-9428-381549a9ab06'::uuid;
update public.workout_exercises set exercise_id = 'f976b159-1ba2-56e7-a0c7-d5da1f6d5f21'::uuid where exercise_id = '1dcd1a31-ec4a-5d56-9428-381549a9ab06'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = 'f976b159-1ba2-56e7-a0c7-d5da1f6d5f21'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '1dcd1a31-ec4a-5d56-9428-381549a9ab06'::uuid;
update public.template_exercises set exercise_id = 'f976b159-1ba2-56e7-a0c7-d5da1f6d5f21'::uuid where exercise_id = '1dcd1a31-ec4a-5d56-9428-381549a9ab06'::uuid;
update public.routine_exercises set exercise_id = 'f976b159-1ba2-56e7-a0c7-d5da1f6d5f21'::uuid where exercise_id = '1dcd1a31-ec4a-5d56-9428-381549a9ab06'::uuid;
delete from public.exercises where id = '1dcd1a31-ec4a-5d56-9428-381549a9ab06'::uuid;
-- hevy-promote score=1.55
update public.sets set exercise_id = '289f9229-026a-5480-a61b-8ffad97a692c'::uuid where exercise_id = 'b3eebe74-169a-5b09-92fc-c19161b1a740'::uuid;
update public.workout_exercises set exercise_id = '289f9229-026a-5480-a61b-8ffad97a692c'::uuid where exercise_id = 'b3eebe74-169a-5b09-92fc-c19161b1a740'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '289f9229-026a-5480-a61b-8ffad97a692c'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = 'b3eebe74-169a-5b09-92fc-c19161b1a740'::uuid;
update public.template_exercises set exercise_id = '289f9229-026a-5480-a61b-8ffad97a692c'::uuid where exercise_id = 'b3eebe74-169a-5b09-92fc-c19161b1a740'::uuid;
update public.routine_exercises set exercise_id = '289f9229-026a-5480-a61b-8ffad97a692c'::uuid where exercise_id = 'b3eebe74-169a-5b09-92fc-c19161b1a740'::uuid;
delete from public.exercises where id = 'b3eebe74-169a-5b09-92fc-c19161b1a740'::uuid;
-- hevy-promote score=0.91
update public.sets set exercise_id = 'fb0ef7c0-939a-5d90-a198-adecee9726ab'::uuid where exercise_id = '0b4cba98-bab8-5afa-8153-94778df43d88'::uuid;
update public.workout_exercises set exercise_id = 'fb0ef7c0-939a-5d90-a198-adecee9726ab'::uuid where exercise_id = '0b4cba98-bab8-5afa-8153-94778df43d88'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = 'fb0ef7c0-939a-5d90-a198-adecee9726ab'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '0b4cba98-bab8-5afa-8153-94778df43d88'::uuid;
update public.template_exercises set exercise_id = 'fb0ef7c0-939a-5d90-a198-adecee9726ab'::uuid where exercise_id = '0b4cba98-bab8-5afa-8153-94778df43d88'::uuid;
update public.routine_exercises set exercise_id = 'fb0ef7c0-939a-5d90-a198-adecee9726ab'::uuid where exercise_id = '0b4cba98-bab8-5afa-8153-94778df43d88'::uuid;
delete from public.exercises where id = '0b4cba98-bab8-5afa-8153-94778df43d88'::uuid;
-- hevy-promote score=1.55
update public.sets set exercise_id = '1af96353-45a8-52b0-921e-a577c58cc9c5'::uuid where exercise_id = '5bac3c69-6749-5de1-ad89-f5cb13337cf7'::uuid;
update public.workout_exercises set exercise_id = '1af96353-45a8-52b0-921e-a577c58cc9c5'::uuid where exercise_id = '5bac3c69-6749-5de1-ad89-f5cb13337cf7'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '1af96353-45a8-52b0-921e-a577c58cc9c5'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '5bac3c69-6749-5de1-ad89-f5cb13337cf7'::uuid;
update public.template_exercises set exercise_id = '1af96353-45a8-52b0-921e-a577c58cc9c5'::uuid where exercise_id = '5bac3c69-6749-5de1-ad89-f5cb13337cf7'::uuid;
update public.routine_exercises set exercise_id = '1af96353-45a8-52b0-921e-a577c58cc9c5'::uuid where exercise_id = '5bac3c69-6749-5de1-ad89-f5cb13337cf7'::uuid;
delete from public.exercises where id = '5bac3c69-6749-5de1-ad89-f5cb13337cf7'::uuid;
-- hevy-promote score=1.02
update public.sets set exercise_id = '8fe482e2-be61-55ef-a785-69ae6bebd9d2'::uuid where exercise_id = '827c727b-14b0-58df-9ab8-aff601c9bf43'::uuid;
update public.workout_exercises set exercise_id = '8fe482e2-be61-55ef-a785-69ae6bebd9d2'::uuid where exercise_id = '827c727b-14b0-58df-9ab8-aff601c9bf43'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '8fe482e2-be61-55ef-a785-69ae6bebd9d2'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '827c727b-14b0-58df-9ab8-aff601c9bf43'::uuid;
update public.template_exercises set exercise_id = '8fe482e2-be61-55ef-a785-69ae6bebd9d2'::uuid where exercise_id = '827c727b-14b0-58df-9ab8-aff601c9bf43'::uuid;
update public.routine_exercises set exercise_id = '8fe482e2-be61-55ef-a785-69ae6bebd9d2'::uuid where exercise_id = '827c727b-14b0-58df-9ab8-aff601c9bf43'::uuid;
delete from public.exercises where id = '827c727b-14b0-58df-9ab8-aff601c9bf43'::uuid;
-- hevy-promote score=1.40
update public.sets set exercise_id = '5362f975-cf8a-5714-a6ed-b09ae10545a9'::uuid where exercise_id = '664229a0-9c9d-5415-81c3-6d8eec3d5d45'::uuid;
update public.workout_exercises set exercise_id = '5362f975-cf8a-5714-a6ed-b09ae10545a9'::uuid where exercise_id = '664229a0-9c9d-5415-81c3-6d8eec3d5d45'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '5362f975-cf8a-5714-a6ed-b09ae10545a9'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '664229a0-9c9d-5415-81c3-6d8eec3d5d45'::uuid;
update public.template_exercises set exercise_id = '5362f975-cf8a-5714-a6ed-b09ae10545a9'::uuid where exercise_id = '664229a0-9c9d-5415-81c3-6d8eec3d5d45'::uuid;
update public.routine_exercises set exercise_id = '5362f975-cf8a-5714-a6ed-b09ae10545a9'::uuid where exercise_id = '664229a0-9c9d-5415-81c3-6d8eec3d5d45'::uuid;
delete from public.exercises where id = '664229a0-9c9d-5415-81c3-6d8eec3d5d45'::uuid;
-- hevy-promote score=1.37
update public.sets set exercise_id = '63c8b6cb-4d82-5b29-81f9-929a4a206d9f'::uuid where exercise_id = 'c8a0bbee-6add-5da1-960d-fb2db1048e96'::uuid;
update public.workout_exercises set exercise_id = '63c8b6cb-4d82-5b29-81f9-929a4a206d9f'::uuid where exercise_id = 'c8a0bbee-6add-5da1-960d-fb2db1048e96'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '63c8b6cb-4d82-5b29-81f9-929a4a206d9f'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = 'c8a0bbee-6add-5da1-960d-fb2db1048e96'::uuid;
update public.template_exercises set exercise_id = '63c8b6cb-4d82-5b29-81f9-929a4a206d9f'::uuid where exercise_id = 'c8a0bbee-6add-5da1-960d-fb2db1048e96'::uuid;
update public.routine_exercises set exercise_id = '63c8b6cb-4d82-5b29-81f9-929a4a206d9f'::uuid where exercise_id = 'c8a0bbee-6add-5da1-960d-fb2db1048e96'::uuid;
delete from public.exercises where id = 'c8a0bbee-6add-5da1-960d-fb2db1048e96'::uuid;
-- hevy-promote score=1.36
update public.sets set exercise_id = '9a2d7237-8eb2-501e-9a0d-d6309a07fd08'::uuid where exercise_id = '46f78030-650d-5826-92c3-4686c4985a49'::uuid;
update public.workout_exercises set exercise_id = '9a2d7237-8eb2-501e-9a0d-d6309a07fd08'::uuid where exercise_id = '46f78030-650d-5826-92c3-4686c4985a49'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '9a2d7237-8eb2-501e-9a0d-d6309a07fd08'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '46f78030-650d-5826-92c3-4686c4985a49'::uuid;
update public.template_exercises set exercise_id = '9a2d7237-8eb2-501e-9a0d-d6309a07fd08'::uuid where exercise_id = '46f78030-650d-5826-92c3-4686c4985a49'::uuid;
update public.routine_exercises set exercise_id = '9a2d7237-8eb2-501e-9a0d-d6309a07fd08'::uuid where exercise_id = '46f78030-650d-5826-92c3-4686c4985a49'::uuid;
delete from public.exercises where id = '46f78030-650d-5826-92c3-4686c4985a49'::uuid;
-- hevy-promote score=1.30
update public.sets set exercise_id = 'b0330be7-e911-592f-ba1c-bcadec0ec14f'::uuid where exercise_id = '0229ef51-10ad-5d4f-a827-dead34307331'::uuid;
update public.workout_exercises set exercise_id = 'b0330be7-e911-592f-ba1c-bcadec0ec14f'::uuid where exercise_id = '0229ef51-10ad-5d4f-a827-dead34307331'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = 'b0330be7-e911-592f-ba1c-bcadec0ec14f'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '0229ef51-10ad-5d4f-a827-dead34307331'::uuid;
update public.template_exercises set exercise_id = 'b0330be7-e911-592f-ba1c-bcadec0ec14f'::uuid where exercise_id = '0229ef51-10ad-5d4f-a827-dead34307331'::uuid;
update public.routine_exercises set exercise_id = 'b0330be7-e911-592f-ba1c-bcadec0ec14f'::uuid where exercise_id = '0229ef51-10ad-5d4f-a827-dead34307331'::uuid;
delete from public.exercises where id = '0229ef51-10ad-5d4f-a827-dead34307331'::uuid;
-- hevy-promote score=1.30
update public.sets set exercise_id = 'b86c7e38-53ba-5294-a2f6-66c9343bc8fc'::uuid where exercise_id = '0b25e15e-7f05-5ba3-a73a-e5239722ea81'::uuid;
update public.workout_exercises set exercise_id = 'b86c7e38-53ba-5294-a2f6-66c9343bc8fc'::uuid where exercise_id = '0b25e15e-7f05-5ba3-a73a-e5239722ea81'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = 'b86c7e38-53ba-5294-a2f6-66c9343bc8fc'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '0b25e15e-7f05-5ba3-a73a-e5239722ea81'::uuid;
update public.template_exercises set exercise_id = 'b86c7e38-53ba-5294-a2f6-66c9343bc8fc'::uuid where exercise_id = '0b25e15e-7f05-5ba3-a73a-e5239722ea81'::uuid;
update public.routine_exercises set exercise_id = 'b86c7e38-53ba-5294-a2f6-66c9343bc8fc'::uuid where exercise_id = '0b25e15e-7f05-5ba3-a73a-e5239722ea81'::uuid;
delete from public.exercises where id = '0b25e15e-7f05-5ba3-a73a-e5239722ea81'::uuid;
-- hevy-promote score=1.30
update public.sets set exercise_id = '0e01567c-ddc3-5ec8-bf40-7850e1f53264'::uuid where exercise_id = '5b7ac7a2-5489-5c9e-9212-91fe5df79f57'::uuid;
update public.workout_exercises set exercise_id = '0e01567c-ddc3-5ec8-bf40-7850e1f53264'::uuid where exercise_id = '5b7ac7a2-5489-5c9e-9212-91fe5df79f57'::uuid
      and not exists (
        select 1 from public.workout_exercises o
        where o.workout_id = workout_exercises.workout_id and o.exercise_id = '0e01567c-ddc3-5ec8-bf40-7850e1f53264'::uuid and o.id <> workout_exercises.id
      );
delete from public.workout_exercises where exercise_id = '5b7ac7a2-5489-5c9e-9212-91fe5df79f57'::uuid;
update public.template_exercises set exercise_id = '0e01567c-ddc3-5ec8-bf40-7850e1f53264'::uuid where exercise_id = '5b7ac7a2-5489-5c9e-9212-91fe5df79f57'::uuid;
update public.routine_exercises set exercise_id = '0e01567c-ddc3-5ec8-bf40-7850e1f53264'::uuid where exercise_id = '5b7ac7a2-5489-5c9e-9212-91fe5df79f57'::uuid;
delete from public.exercises where id = '5b7ac7a2-5489-5c9e-9212-91fe5df79f57'::uuid;
commit;