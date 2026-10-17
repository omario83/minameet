-- Stap 1b: categorie en akkoord op de voorwaarden bij het aanmelden van een partner.
-- Vereist dat 0004 al is uitgevoerd.

alter table vendors
  add column primary_category listing_category,
  add column terms_accepted_at timestamptz,
  add column terms_version text;

-- Een nieuwe partner begint als concept; 'pending' betekent vanaf nu: ingestuurd ter controle.
alter table vendors alter column status set default 'draft';

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- Alleen 'vendor' of 'customer'; 'admin' is via metadata nooit mogelijk.
  new_role user_role := case when meta->>'role' = 'vendor' then 'vendor' else 'customer' end;
  company text := nullif(trim(meta->>'company_name'), '');
  v_category listing_category;
  v_terms text := left(nullif(trim(meta->>'terms_version'), ''), 30);
  v_accepted timestamptz;
begin
  insert into profiles (id, role, full_name)
  values (new.id, new_role, meta->>'full_name');

  if new_role = 'vendor' then
    -- Een onbekende of ontbrekende categorie wordt 'other' in plaats van de signup te laten mislukken.
    select c into v_category from unnest(enum_range(null::listing_category)) c
    where c::text = meta->>'category';
    v_category := coalesce(v_category, 'other');

    if v_terms is not null then
      begin
        v_accepted := (meta->>'terms_accepted_at')::timestamptz;
      exception when others then
        v_accepted := null;
      end;
      -- Ontbrekend, onleesbaar of in de toekomst: het moment van aanmaken.
      if v_accepted is null or v_accepted > now() then v_accepted := now(); end if;
    end if;

    insert into vendors (owner_id, company_name, slug, primary_category, terms_accepted_at, terms_version)
    values (
      new.id,
      coalesce(company, 'Nieuwe leverancier'),
      trim(both '-' from regexp_replace(lower(coalesce(company, 'leverancier')), '[^a-z0-9]+', '-', 'g'))
        || '-' || substr(replace(new.id::text, '-', ''), 1, 6),
      v_category,
      v_accepted,
      v_terms
    );
  end if;
  return new;
end $$;

-- Het bewijs van akkoord mag een partner niet zelf aanpassen.
create or replace function guard_vendor_update() returns trigger
language plpgsql as $$
begin
  if (new.commission_pct is distinct from old.commission_pct
      or new.status is distinct from old.status
      or new.owner_id is distinct from old.owner_id
      or new.terms_accepted_at is distinct from old.terms_accepted_at
      or new.terms_version is distinct from old.terms_version)
     and is_client() and coalesce(auth_role()::text, '') <> 'admin' then
    raise exception 'Alleen een admin kan commissie, status of voorwaarden wijzigen';
  end if;
  return new;
end $$;
