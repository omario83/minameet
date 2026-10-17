-- Stap 3: bedrijfsgegevens van partners. Niet publiek: alleen de eigenaar en admins hebben toegang, anon niets.
-- Vereist 0005 (en dus 0004).
--
-- Al uitgevoerd onder de oude naam 0006_vendor_details.sql? Voer dan alleen het deel vanaf
-- "Herhaalbaar" opnieuw uit: dat vervangt de functie, de policies en de updated_at-trigger.

create table vendor_details (
  vendor_id uuid primary key references vendors(id) on delete cascade,
  kvk text not null constraint vendor_details_kvk_key unique check (kvk ~ '^[0-9]{8}$'),
  vat_number text check (vat_number ~ '^NL[0-9]{9}B[0-9]{2}$'),
  street text not null,
  house_number integer not null check (house_number > 0),
  house_number_addition text,
  postal_code text not null check (postal_code ~ '^[1-9][0-9]{3} ?(?!SA|SD|SS)[A-Z]{2}$'),
  city text not null,
  -- E.164, bijvoorbeeld +31612345678
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  website text check (website ~* '^https?://'),
  contact_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table vendor_details enable row level security;
revoke all on vendor_details from anon;

-- Herhaalbaar --------------------------------------------------------------

-- Wijzigen kan tijdens de aanmelding, na een afkeuring en na goedkeuring; niet tijdens de beoordeling
-- en niet voor een geblokkeerde partner.
create or replace function vendor_details_editable(vid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vendors
    where id = vid and owner_id = auth.uid() and status in ('draft', 'rejected', 'approved')
  )
$$;

drop policy if exists vendor_details_select on vendor_details;
drop policy if exists vendor_details_insert on vendor_details;
drop policy if exists vendor_details_update on vendor_details;
drop policy if exists vendor_details_admin_write on vendor_details;

create policy vendor_details_select on vendor_details for select to authenticated
  using (owns_vendor(vendor_id) or auth_role() = 'admin');
create policy vendor_details_insert on vendor_details for insert to authenticated
  with check (vendor_details_editable(vendor_id));
create policy vendor_details_update on vendor_details for update to authenticated
  using (vendor_details_editable(vendor_id)) with check (vendor_details_editable(vendor_id));
-- Beheerders mogen alles aanpassen, ook tijdens de beoordeling.
create policy vendor_details_admin_write on vendor_details for all to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

create or replace function set_vendor_details_updated_at() returns trigger
language plpgsql as $$
begin
  -- clock_timestamp(): ook binnen één transactie een nieuw tijdstip.
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists set_vendor_details_updated_at on vendor_details;
create trigger set_vendor_details_updated_at before update on vendor_details
for each row execute function set_vendor_details_updated_at();
