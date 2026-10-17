-- Tests voor de signup-trigger handle_new_user (stap 1). Geen migratie: niet automatisch uitvoeren.
-- Gebruik: plak dit in de Supabase SQL-editor (draait als postgres) nadat 0004 en 0005 zijn uitgevoerd.
-- Alles gebeurt in één transactie die aan het eind wordt teruggedraaid.

begin;

do $$
declare
  u uuid;
  r user_role;
  v vendors;
  n integer;
  txt text;
begin
  -- role 'admin' via metadata wordt nooit admin
  u := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (u, 'admin-poging@test.invalid', '{"role":"admin","full_name":"Hacker"}', 'authenticated', 'authenticated');
  select role into r from profiles where id = u;
  if r is distinct from 'customer' then raise exception 'FAIL: role admin in metadata gaf profiel met role %', r; end if;
  raise notice 'OK: role admin in metadata geeft een customer';

  -- role admin gecombineerd met vendor-gegevens maakt ook geen admin of vendor
  select count(*) into n from vendors where owner_id = u;
  if n <> 0 then raise exception 'FAIL: customer kreeg een vendors-rij'; end if;
  raise notice 'OK: customer krijgt geen vendors-rij';

  -- andere varianten van role vallen terug op customer
  foreach txt in array array['VENDOR', 'vendor ', 'superuser', 'Admin'] loop
    u := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data, aud, role)
    values (u, u::text || '@test.invalid', jsonb_build_object('role', txt), 'authenticated', 'authenticated');
    select role into r from profiles where id = u;
    if r is distinct from 'customer' then raise exception 'FAIL: role % gaf %', txt, r; end if;
  end loop;
  raise notice 'OK: onbekende rollen worden customer';

  -- geldige vendor
  u := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (u, 'vendor-ok@test.invalid',
    '{"role":"vendor","company_name":"Zaal Oost","full_name":"Aylin","category":"catering","terms_version":"2026-10-17","terms_accepted_at":"2026-10-17T10:00:00Z"}',
    'authenticated', 'authenticated');
  select * into v from vendors where owner_id = u;
  if v.status <> 'draft' then raise exception 'FAIL: nieuwe vendor heeft status %, verwacht draft', v.status; end if;
  if v.primary_category <> 'catering' then raise exception 'FAIL: categorie % in plaats van catering', v.primary_category; end if;
  if v.terms_accepted_at is null or v.terms_version <> '2026-10-17' then raise exception 'FAIL: voorwaarden niet overgenomen'; end if;
  if v.terms_accepted_at <> '2026-10-17T10:00:00Z'::timestamptz then raise exception 'FAIL: tijdstip akkoord niet overgenomen'; end if;
  raise notice 'OK: nieuwe vendor is draft met categorie en voorwaarden';

  -- ongeldige of ontbrekende categorie wordt 'other'
  foreach txt in array array[
    '{"role":"vendor","company_name":"X","category":"bestaat-niet","terms_version":"t"}',
    '{"role":"vendor","company_name":"X","category":"admin","terms_version":"t"}',
    '{"role":"vendor","company_name":"X","category":"","terms_version":"t"}',
    '{"role":"vendor","company_name":"X","terms_version":"t"}'
  ] loop
    u := gen_random_uuid();
    insert into auth.users (id, email, raw_user_meta_data, aud, role)
    values (u, u::text || '@test.invalid', txt::jsonb, 'authenticated', 'authenticated');
    select * into v from vendors where owner_id = u;
    if v.primary_category is distinct from 'other' then raise exception 'FAIL: % gaf categorie %', txt, v.primary_category; end if;
  end loop;
  raise notice 'OK: ongeldige of ontbrekende categorie wordt other';

  -- onleesbare of toekomstige datum voor akkoord wordt het moment van aanmaken
  u := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (u, 'datum-onzin@test.invalid',
    '{"role":"vendor","company_name":"X","category":"dj","terms_version":"t","terms_accepted_at":"geen datum"}', 'authenticated', 'authenticated');
  select * into v from vendors where owner_id = u;
  if v.terms_accepted_at is null then raise exception 'FAIL: onleesbare datum gaf null'; end if;

  u := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (u, 'datum-toekomst@test.invalid',
    '{"role":"vendor","company_name":"X","category":"dj","terms_version":"t","terms_accepted_at":"2999-01-01T00:00:00Z"}', 'authenticated', 'authenticated');
  select * into v from vendors where owner_id = u;
  if v.terms_accepted_at > now() then raise exception 'FAIL: datum in de toekomst is overgenomen'; end if;
  raise notice 'OK: ongeldige datum voor akkoord wordt het moment van aanmaken';

  -- zonder voorwaarden: de database zet niets (de server-actie en het formulier dwingen het vinkje af)
  u := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (u, 'zonder-voorwaarden@test.invalid', '{"role":"vendor","company_name":"X","category":"dj"}', 'authenticated', 'authenticated');
  select * into v from vendors where owner_id = u;
  if v.terms_accepted_at is not null or v.terms_version is not null then raise exception 'FAIL: voorwaarden zonder metadata gevuld'; end if;
  raise notice 'OK: zonder voorwaardenmetadata blijven de velden leeg';

  raise notice 'ALLE TESTS GESLAAGD';
end $$;

rollback;
