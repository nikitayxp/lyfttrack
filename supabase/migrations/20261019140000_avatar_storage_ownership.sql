-- Forward fix for the deployed Avatar Insert/Update/Delete policies. The storage
-- bucket, objects table and public-read policy predate this migration history;
-- this file does not provision a fresh Supabase project (see README.md).
begin;

drop policy if exists "Avatar Insert" on storage.objects;
create policy "Avatar Insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Avatar Update" on storage.objects;
create policy "Avatar Update"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Avatar Delete" on storage.objects;
create policy "Avatar Delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
