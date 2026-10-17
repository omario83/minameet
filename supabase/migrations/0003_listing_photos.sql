-- Foto's van aanbod: openbare opslag, schrijven alleen in de map van de eigen leverancier.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "listing photos upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and public.owns_vendor(((storage.foldername(name))[1])::uuid)
  );

create policy "listing photos delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and public.owns_vendor(((storage.foldername(name))[1])::uuid)
  );
