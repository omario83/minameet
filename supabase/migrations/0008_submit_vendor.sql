-- Stap 5: insturen ter controle. Vereist 0004 t/m 0007.

alter table vendors
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column rejection_reason text;

create or replace function guard_vendor_update() returns trigger
language plpgsql as $$
begin
  if (new.commission_pct is distinct from old.commission_pct
      or new.status is distinct from old.status
      or new.owner_id is distinct from old.owner_id
      or new.terms_accepted_at is distinct from old.terms_accepted_at
      or new.terms_version is distinct from old.terms_version
      or new.submitted_at is distinct from old.submitted_at
      or new.reviewed_at is distinct from old.reviewed_at
      or new.rejection_reason is distinct from old.rejection_reason)
     and is_client() and coalesce(auth_role()::text, '') <> 'admin' then
    raise exception 'Alleen een admin kan commissie, status of beoordeling wijzigen';
  end if;
  return new;
end $$;

-- Partners kunnen hun status niet zelf wijzigen; deze functie (security definer) is de enige weg naar 'pending'.
create function submit_vendor_for_review() returns void
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
    where l.vendor_id = v.id and coalesce(array_length(l.photos, 1), 0) < 5
  ) then
    raise exception 'Elk aanbod heeft minimaal 5 foto''s nodig';
  end if;

  update vendors
  set status = 'pending', submitted_at = now(), reviewed_at = null, rejection_reason = null
  where id = v.id;
end $$;

revoke all on function submit_vendor_for_review() from public, anon;
grant execute on function submit_vendor_for_review() to authenticated;

-- Partners die al 'pending' waren voordat dit proces bestond en nog geen bedrijfsgegevens hebben,
-- doorlopen alsnog de aanmelding.
update vendors set status = 'draft'
where status = 'pending' and not exists (select 1 from vendor_details d where d.vendor_id = vendors.id);
