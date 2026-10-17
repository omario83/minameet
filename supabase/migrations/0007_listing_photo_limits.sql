-- Stap 4: foto-opslag aanscherpen (10 MB, alleen jpeg/png/webp, alleen in de eigen map).
-- Vereist 0003. Pad van een foto: <vendor_id>/<listing_id>/<bestand>.

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'listing-photos';

-- Controleert het pad zonder een ongeldige uuid-cast die de query laat crashen.
create function storage_folder_owned(p_name text) returns boolean
language sql stable set search_path = public, storage as $$
  select case
    when array_length(storage.foldername(p_name), 1) = 2
     and (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.owns_vendor(((storage.foldername(p_name))[1])::uuid)
    else false
  end
$$;

drop policy if exists "listing photos upload" on storage.objects;
drop policy if exists "listing photos delete" on storage.objects;

create policy "listing photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and public.storage_folder_owned(name));

create policy "listing photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and public.storage_folder_owned(name));
