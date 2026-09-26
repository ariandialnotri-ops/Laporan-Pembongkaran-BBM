-- Foto segel/DO dan hasil tera. Bucket privat; unggah boleh, baca lewat URL bertanda tangan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bukti-bongkaran', 'bukti-bongkaran', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "bukti unggah" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'bukti-bongkaran');
create policy "bukti baca" on storage.objects for select to anon, authenticated
  using (bucket_id = 'bukti-bongkaran');
