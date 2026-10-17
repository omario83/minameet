-- Stap 4b: foto's van een aanbod moeten echt bestaan en bij dat aanbod horen. Vereist 0007 en 0008.
-- Zonder dit kon een partner via de API vijf verzonnen paden in `listings.photos` zetten en zo de eis van 5 foto's omzeilen.

-- Aantal foto's dat in Storage bestaat, in de map <vendor_id>/<listing_id>/ van dit aanbod.
create function valid_photo_count(p_vendor uuid, p_listing uuid, p_photos text[]) returns integer
language sql stable security definer set search_path = public, storage as $$
  select count(*)::integer
  from unnest(coalesce(p_photos, '{}')) as p(path)
  where p.path like p_vendor::text || '/' || p_listing::text || '/%'
    and p.path not like '%..%'
    and exists (select 1 from storage.objects o where o.bucket_id = 'listing-photos' and o.name = p.path)
$$;

revoke all on function valid_photo_count(uuid, uuid, text[]) from public, anon;
grant execute on function valid_photo_count(uuid, uuid, text[]) to authenticated;

create or replace function submit_vendor_for_review() returns void
language plpgsql security definer set search_path = public as $$
declare
  v vendors;
begin
  select * into v from vendors where owner_id = auth.uid() for update;
  if not found then raise exception 'Geen leveranciersaccount'; end if;
  if v.status not in ('draft', 'rejected') then
    raise exception 'Deze aanmelding is al ingestuurd';
  end if;
  if not exists (select 1 from vendor_details d where d.vendor_id = v.id) then
    raise exception 'Vul eerst je bedrijfsgegevens in';
  end if;
  if not exists (select 1 from listings l where l.vendor_id = v.id) then
    raise exception 'Voeg eerst een aanbod toe';
  end if;
  if exists (
    select 1 from listings l
    where l.vendor_id = v.id and valid_photo_count(l.vendor_id, l.id, l.photos) < 5
  ) then
    raise exception 'Elk aanbod heeft minimaal 5 foto''s nodig';
  end if;

  update vendors
  set status = 'pending', submitted_at = now(), reviewed_at = null, rejection_reason = null
  where id = v.id;
end $$;

-- Partners mogen alleen paden in de map van het eigen aanbod opslaan, maximaal 8.
create function guard_listing_photos() returns trigger
language plpgsql as $$
declare
  p text;
begin
  if not is_client() then return new; end if;

  if coalesce(array_length(new.photos, 1), 0) > 8 then
    raise exception 'Maximaal 8 foto''s per aanbod';
  end if;
  foreach p in array coalesce(new.photos, '{}') loop
    if p not like new.vendor_id::text || '/' || new.id::text || '/%' or p like '%..%' then
      raise exception 'Ongeldig fotopad';
    end if;
  end loop;
  return new;
end $$;

create trigger guard_listing_photos before insert or update of photos on listings
for each row execute function guard_listing_photos();

-- Minimum mag niet boven het maximum liggen. NOT VALID: bestaande rijen blijven ongemoeid, nieuwe en gewijzigde rijen worden gecontroleerd.
alter table listings add constraint listings_guests_range
  check (min_guests is null or max_guests is null or min_guests <= max_guests) not valid;
