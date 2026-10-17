-- Stap 5c: insturen vereist akkoord op de partnervoorwaarden. Vereist 0005, 0008 en 0010.
-- Partners die zich aanmeldden voordat het vinkje bestond hebben geen akkoord vastgelegd; zij geven het alsnog bij het insturen.

-- Legt het akkoord van de ingelogde partner eenmalig vast (security definer: partners mogen deze kolommen niet zelf wijzigen).
create function accept_partner_terms(p_version text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_version text := left(nullif(trim(p_version), ''), 30);
begin
  if v_version is null then raise exception 'Ongeldige versie van de voorwaarden'; end if;

  update vendors
  set terms_accepted_at = now(), terms_version = v_version
  where owner_id = auth.uid() and terms_accepted_at is null and status in ('draft', 'rejected');
end $$;

revoke all on function accept_partner_terms(text) from public, anon;
grant execute on function accept_partner_terms(text) to authenticated;

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
  if v.terms_accepted_at is null then
    raise exception 'Ga eerst akkoord met de partnervoorwaarden';
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
