-- Run in Yumorilnik Supabase project once.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('event-images','event-images',true,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "yumorilnik_event_images_admin_insert" on storage.objects;
create policy "yumorilnik_event_images_admin_insert" on storage.objects for insert to authenticated
with check (
 bucket_id='event-images'
 and exists (select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin'))
);

drop policy if exists "yumorilnik_event_images_admin_delete" on storage.objects;
create policy "yumorilnik_event_images_admin_delete" on storage.objects for delete to authenticated
using (
 bucket_id='event-images'
 and exists (select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role in ('owner','admin'))
);
-- Public bucket images may be viewed by anybody who knows their URL.
-- Uploads use unique paths and are not overwritten.
