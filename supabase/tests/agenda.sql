-- Beveiligingstests voor de agenda. Geen migratie: niet automatisch uitvoeren.
-- Gebruik: plak dit in de Supabase SQL-editor (draait als postgres) nadat 0013 is uitgevoerd.
-- Alles gebeurt in één transactie die aan het eind wordt teruggedraaid. Een mislukte test stopt het script
-- met "FAIL: ..."; per geslaagde test verschijnt een melding "OK: ...".

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000011', 'agenda-a@test.invalid',
   '{"role":"vendor","company_name":"Agenda A","category":"venue","terms_version":"test"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000012', 'agenda-b@test.invalid',
   '{"role":"vendor","company_name":"Agenda B","category":"dj","terms_version":"test"}', 'authenticated', 'authenticated');

do $$
declare
  u_a uuid := 'aaaaaaaa-0000-4000-8000-000000000011';
  u_b uuid := 'bbbbbbbb-0000-4000-8000-000000000012';
  v_a uuid;
  v_b uuid;
  l_b uuid;
  f_a uuid;
  i_a uuid;
  n integer;
begin
  select id into v_a from vendors where owner_id = u_a;
  select id into v_b from vendors where owner_id = u_b;
  insert into listings (vendor_id, category, title) values (v_b, 'dj', 'DJ van B') returning id into l_b;

  -- Nieuwe partners doorlopen de instelassistent -------------------------------
  if (select setup_completed_at from vendors where id = v_a) is not null then
    raise exception 'FAIL: nieuwe partner heeft de instelassistent al afgerond';
  end if;
  raise notice 'OK: nieuwe partner begint zonder afgeronde instelassistent';

  -- Partner A -------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update vendors set setup_completed_at = now() where id = v_a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: partner kon de instelassistent niet afronden'; end if;
  raise notice 'OK: partner rondt de instelassistent zelf af';

  insert into vendor_opening_hours (vendor_id, weekday, is_closed) values (v_a, 6, true);
  begin
    insert into vendor_opening_hours (vendor_id, weekday, opens, closes) values (v_a, 0, '18:00', '08:00');
    raise exception 'FAIL: sluiten voor openen is toegestaan';
  exception when check_violation then
    raise notice 'OK: openingstijden moeten kloppen';
  end;

  insert into agenda_items (vendor_id, title, starts_at, ends_at) values (v_a, 'Eigen afspraak', now(), now() + interval '1 hour') returning id into i_a;
  begin
    insert into agenda_items (vendor_id, title, starts_at, ends_at) values (v_a, 'Omgekeerd', now() + interval '1 hour', now());
    raise exception 'FAIL: einde voor begin is toegestaan';
  exception when check_violation then
    raise notice 'OK: einde moet na begin liggen';
  end;
  begin
    insert into agenda_items (vendor_id, title, starts_at, ends_at) values (v_a, 'Veel te lang', now(), now() + interval '63 days');
    raise exception 'FAIL: afspraak langer dan 62 dagen is toegestaan';
  exception when check_violation then
    raise notice 'OK: maximaal 62 dagen';
  end;

  -- Aanbod van een andere partner koppelen mag niet ---------------------------
  begin
    insert into agenda_items (vendor_id, listing_id, title, starts_at, ends_at) values (v_a, l_b, 'Vreemd aanbod', now(), now() + interval '1 hour');
    raise exception 'FAIL: aanbod van een andere partner gekoppeld';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: vreemd aanbod geweigerd (%)', sqlerrm;
  end;

  insert into calendar_feeds (vendor_id, url) values (v_a, 'https://example.com/a.ics') returning id into f_a;
  begin
    insert into calendar_feeds (vendor_id, url) values (v_a, 'http://example.com/a.ics');
    raise exception 'FAIL: een http-adres is toegestaan';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: alleen https-adressen (%)', sqlerrm;
  end;

  -- Partner B ziet en wijzigt niets van A ------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);

  select count(*) into n from agenda_items where vendor_id = v_a;
  if n <> 0 then raise exception 'FAIL: partner B ziet % agenda-items van A', n; end if;
  select count(*) into n from calendar_feeds where vendor_id = v_a;
  if n <> 0 then raise exception 'FAIL: partner B ziet de kalenderkoppeling van A'; end if;
  select count(*) into n from vendor_opening_hours where vendor_id = v_a;
  if n <> 0 then raise exception 'FAIL: partner B ziet de openingstijden van A'; end if;
  raise notice 'OK: partner B ziet niets van A';

  update agenda_items set title = 'Gehackt' where id = i_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: partner B kon een item van A wijzigen'; end if;
  delete from agenda_items where id = i_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: partner B kon een item van A verwijderen'; end if;
  delete from calendar_feeds where id = f_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: partner B kon de koppeling van A verwijderen'; end if;
  raise notice 'OK: partner B kan niets van A wijzigen of verwijderen';

  begin
    insert into agenda_items (vendor_id, title, starts_at, ends_at) values (v_a, 'Binnengeslopen', now(), now() + interval '1 hour');
    raise exception 'FAIL: partner B kon een item in de agenda van A zetten';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: item in andermans agenda geweigerd';
  end;

  -- Anoniem ----------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    perform 1 from agenda_items;
    raise exception 'FAIL: anoniem kon agenda_items lezen';
  exception when insufficient_privilege then
    raise notice 'OK: anoniem heeft geen toegang tot de agenda';
  end;
  begin
    perform 1 from calendar_feeds;
    raise exception 'FAIL: anoniem kon calendar_feeds lezen';
  exception when insufficient_privilege then
    raise notice 'OK: anoniem heeft geen toegang tot kalenderkoppelingen';
  end;
  reset role;
end $$;

rollback;
