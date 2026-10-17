-- Beveiligingstests voor de partner-aanmelding. Geen migratie: niet automatisch uitvoeren.
-- Gebruik: plak dit in de Supabase SQL-editor (draait als postgres) nadat 0003 t/m 0012 zijn uitgevoerd.
-- Alles gebeurt in één transactie die aan het eind wordt teruggedraaid. Een mislukte test stopt het script
-- met "FAIL: ..."; per geslaagde test verschijnt een melding "OK: ...".

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'partner-a@test.invalid',
   '{"role":"vendor","company_name":"Test A","category":"venue","terms_version":"test"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'partner-b@test.invalid',
   '{"role":"vendor","company_name":"Test B","category":"dj","terms_version":"test"}', 'authenticated', 'authenticated'),
  ('cccccccc-0000-4000-8000-000000000003', 'admin@test.invalid', '{}', 'authenticated', 'authenticated');
update profiles set role = 'admin' where id = 'cccccccc-0000-4000-8000-000000000003';

do $$
declare
  u_a uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  u_b uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  u_c uuid := 'cccccccc-0000-4000-8000-000000000003';
  u_w uuid := gen_random_uuid();
  v_a uuid;
  v_b uuid;
  l_a uuid;
  cname text;
  l_b uuid;
  pfx_b text;
  txt text;
  pfx text;
  n integer;
  s text;
  clause text;
begin
  select id into v_a from vendors where owner_id = u_a;
  select id into v_b from vendors where owner_id = u_b;

  -- Registratie ----------------------------------------------------------
  select status::text into s from vendors where id = v_a;
  if s <> 'draft' then raise exception 'FAIL: nieuwe partner heeft status %, verwacht draft', s; end if;
  raise notice 'OK: nieuwe partner begint als draft';

  -- Partner A: eigen status, commissie en voorwaarden wijzigen moet falen --------
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    update vendors set status = 'approved' where owner_id = u_a;
    raise exception 'FAIL: partner kon zijn eigen status wijzigen';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: status wijzigen geweigerd (%)', sqlerrm;
  end;

  begin
    update vendors set status = 'pending' where owner_id = u_a;
    raise exception 'FAIL: partner kon zichzelf op pending zetten zonder submit-functie';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: direct naar pending geweigerd (%)', sqlerrm;
  end;

  begin
    update vendors set commission_pct = 0 where owner_id = u_a;
    raise exception 'FAIL: partner kon zijn eigen commissie wijzigen';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: commissie wijzigen geweigerd (%)', sqlerrm;
  end;

  begin
    update vendors set terms_version = 'andere', reviewed_at = now() where owner_id = u_a;
    raise exception 'FAIL: partner kon voorwaarden of beoordeling wijzigen';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: voorwaarden/beoordeling wijzigen geweigerd (%)', sqlerrm;
  end;

  -- Bedrijfsgegevens ------------------------------------------------------
  insert into vendor_details (vendor_id, kvk, street, house_number, postal_code, city, phone, contact_email)
  values (v_a, '12345678', 'Dam', 1, '1012 JS', 'Amsterdam', '+31201234567', 'a@test.invalid');
  raise notice 'OK: partner A maakte eigen bedrijfsgegevens aan';

  update vendor_details set city = 'Utrecht' where vendor_id = v_a;
  if (select updated_at <= created_at from vendor_details where vendor_id = v_a) then
    raise exception 'FAIL: updated_at is niet bijgewerkt door de trigger';
  end if;
  raise notice 'OK: updated_at wordt bij een wijziging bijgewerkt';

  select count(*) into n from vendor_details where vendor_id = v_a;
  if n <> 1 then raise exception 'FAIL: partner A ziet zijn eigen gegevens niet'; end if;

  begin
    insert into vendor_details (vendor_id, kvk, street, house_number, postal_code, city, phone, contact_email)
    values (v_a, '87654321', 'Dam', 1, '1234 SA', 'Amsterdam', '+31201234567', 'a@test.invalid');
    raise exception 'FAIL: ongeldige postcode (SA) geaccepteerd';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: postcode 1234 SA geweigerd (%)', sqlerrm;
  end;

  -- Formaatcontroles in de database, naast die in de app
  foreach clause in array array[
    $c$kvk = '1234567'$c$,
    $c$kvk = '12345678a'$c$,
    $c$phone = '0612345678'$c$,
    $c$phone = '+31'$c$,
    $c$website = 'javascript:alert(1)'$c$,
    $c$website = 'ftp://voorbeeld.nl'$c$,
    $c$vat_number = 'NL12345'$c$,
    $c$house_number = 0$c$
  ] loop
    begin
      execute format('update vendor_details set %s where vendor_id = %L', clause, v_a);
      raise exception 'FAIL: ongeldige waarde geaccepteerd: %', clause;
    exception when check_violation then
      raise notice 'OK: % geweigerd (check_violation)', clause;
    end;
  end loop;

  -- Partner B ------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from vendor_details where vendor_id = v_a;
  if n <> 0 then raise exception 'FAIL: partner B kan bedrijfsgegevens van A lezen'; end if;
  raise notice 'OK: bedrijfsgegevens van A zijn niet leesbaar voor B';

  begin
    insert into vendor_details (vendor_id, kvk, street, house_number, postal_code, city, phone, contact_email)
    values (v_a, '11111111', 'Dam', 1, '1012 JS', 'Amsterdam', '+31201234567', 'b@test.invalid');
    raise exception 'FAIL: partner B kon gegevens voor A aanmaken';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: B kan geen gegevens voor A aanmaken (%)', sqlerrm;
  end;

  update vendor_details set city = 'Gehackt' where vendor_id = v_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: partner B kon bedrijfsgegevens van A wijzigen'; end if;
  delete from vendor_details where vendor_id = v_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: partner B kon bedrijfsgegevens van A verwijderen'; end if;
  raise notice 'OK: B kan bedrijfsgegevens van A niet wijzigen of verwijderen';

  begin
    insert into vendor_details (vendor_id, kvk, street, house_number, postal_code, city, phone, contact_email)
    values (v_b, '12345678', 'Dam', 1, '1012 JS', 'Amsterdam', '+31201234567', 'b@test.invalid');
    raise exception 'FAIL: dubbel KvK-nummer geaccepteerd';
  exception when unique_violation then
    get stacked diagnostics cname = constraint_name;
    if cname is distinct from 'vendor_details_kvk_key' then
      raise exception 'FAIL: unieke-sleutelfout op % in plaats van vendor_details_kvk_key', cname;
    end if;
    raise notice 'OK: dubbel KvK-nummer geeft unique_violation op %', cname;
  end;

  -- Storage: B uploadt in de map van A ---------------------------------------
  begin
    insert into storage.objects (bucket_id, name) values ('listing-photos', v_a::text || '/' || gen_random_uuid()::text || '/x.jpg');
    raise exception 'FAIL: partner B kon uploaden in de map van A';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: upload in andermans map geweigerd (%)', sqlerrm;
  end;

  begin
    insert into storage.objects (bucket_id, name) values ('listing-photos', 'geen-uuid/' || gen_random_uuid()::text || '/x.jpg');
    raise exception 'FAIL: pad zonder vendor-uuid geaccepteerd';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: pad zonder vendor-uuid geweigerd (%)', sqlerrm;
  end;

  insert into storage.objects (bucket_id, name) values ('listing-photos', v_b::text || '/' || gen_random_uuid()::text || '/x.jpg');
  raise notice 'OK: B mag in de eigen map uploaden';

  -- Anoniem ----------------------------------------------------------------
  reset role;
  set local role anon;
  select count(*) into n from vendor_details;
  if n <> 0 then raise exception 'FAIL: anoniem ziet % bedrijfsgegevens', n; end if;
  raise notice 'OK: bedrijfsgegevens zijn niet publiek leesbaar';

  begin
    update vendor_details set city = 'Anoniem' where vendor_id = v_a;
    raise exception 'FAIL: anoniem kon bedrijfsgegevens wijzigen';
  exception when insufficient_privilege then
    raise notice 'OK: anoniem mag bedrijfsgegevens niet wijzigen (permission denied)';
  end; ---------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from vendor_details where vendor_id = v_a;
  if n <> 1 then raise exception 'FAIL: admin kan bedrijfsgegevens niet lezen'; end if;
  raise notice 'OK: admin leest bedrijfsgegevens';

  -- Insturen -----------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    perform submit_vendor_for_review();
    raise exception 'FAIL: insturen zonder aanbod gelukt';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: insturen zonder aanbod geweigerd (%)', sqlerrm;
  end;

  reset role;
  l_a := gen_random_uuid();
  pfx := v_a::text || '/' || l_a::text || '/';
  insert into listings (id, vendor_id, category, title, photos)
  values (l_a, v_a, 'venue', 'Testzaal', array(select pfx || g || '.jpg' from generate_series(1, 4) g));
  insert into storage.objects (bucket_id, name) select 'listing-photos', pfx || g || '.jpg' from generate_series(1, 4) g;
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    perform submit_vendor_for_review();
    raise exception 'FAIL: insturen met 4 foto''s gelukt';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: insturen met 4 foto''s geweigerd (%)', sqlerrm;
  end;

  -- Omzeilen: vijf verzonnen paden in de eigen map, zonder bestand in Storage
  update listings set photos = array(select pfx || 'nep' || g || '.jpg' from generate_series(1, 5) g) where id = l_a;
  begin
    perform submit_vendor_for_review();
    raise exception 'FAIL: insturen met verzonnen fotopaden gelukt';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: verzonnen fotopaden tellen niet mee (%)', sqlerrm;
  end;

  -- Foto's van een ander aanbod, te veel foto's en padtrucs worden bij het opslaan geweigerd
  foreach clause in array array[
    format('array[%L]', v_b::text || '/' || gen_random_uuid()::text || '/x.jpg'),
    format('array[%L]', pfx || '../../x.jpg'),
    format('array(select %L || g || %L from generate_series(1, 9) g)', pfx, '.jpg')
  ] loop
    begin
      execute format('update listings set photos = %s where id = %L', clause, l_a);
      raise exception 'FAIL: ongeldige fotolijst geaccepteerd: %', clause;
    exception when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      raise notice 'OK: ongeldige fotolijst geweigerd (%)', sqlerrm;
    end;
  end loop;

  begin
    update listings set min_guests = 50, max_guests = 10 where id = l_a;
    raise exception 'FAIL: minimum boven maximum geaccepteerd';
  exception when check_violation then
    raise notice 'OK: minimum boven maximum geweigerd';
  end;

  reset role;
  insert into storage.objects (bucket_id, name) select 'listing-photos', pfx || g || '.jpg' from generate_series(5, 5) g;
  update listings set photos = array(select pfx || g || '.jpg' from generate_series(1, 5) g) where id = l_a;
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  perform submit_vendor_for_review();
  reset role;
  select status::text into s from vendors where id = v_a;
  if s <> 'pending' then raise exception 'FAIL: status na insturen is %, verwacht pending', s; end if;
  raise notice 'OK: insturen met 5 foto''s gelukt, status pending';

  set local role authenticated;
  begin
    perform submit_vendor_for_review();
    raise exception 'FAIL: tweede keer insturen gelukt';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: opnieuw insturen geweigerd (%)', sqlerrm;
  end;

  -- Tijdens de beoordeling is het aanbod vergrendeld
  begin
    update listings set title = 'Aangepast na insturen' where id = l_a;
    raise exception 'FAIL: aanbod te wijzigen tijdens de beoordeling';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: aanbod wijzigen tijdens de beoordeling geweigerd (%)', sqlerrm;
  end;

  begin
    insert into listings (vendor_id, category, title) values (v_a, 'dj', 'Nieuw na insturen');
    raise exception 'FAIL: aanbod toe te voegen tijdens de beoordeling';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: aanbod toevoegen tijdens de beoordeling geweigerd (%)', sqlerrm;
  end;

  begin
    delete from listings where id = l_a;
    raise exception 'FAIL: aanbod te verwijderen tijdens de beoordeling';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: aanbod verwijderen tijdens de beoordeling geweigerd (%)', sqlerrm;
  end;

  update vendor_details set city = 'Rotterdam' where vendor_id = v_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: bedrijfsgegevens zijn te wijzigen tijdens de beoordeling'; end if;
  raise notice 'OK: bedrijfsgegevens zijn vergrendeld tijdens de beoordeling';

  -- Goedkeuren ----------------------------------------------------------
  begin
    perform approve_vendor(v_a);
    raise exception 'FAIL: partner kon zichzelf goedkeuren';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: partner kan zichzelf niet goedkeuren (%)', sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    perform reject_vendor(v_a, '   ');
    raise exception 'FAIL: afkeuren zonder reden gelukt';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: afkeuren zonder reden geweigerd (%)', sqlerrm;
  end;

  perform approve_vendor(v_a);
  reset role;
  select status::text into s from vendors where id = v_a;
  if s <> 'approved' then raise exception 'FAIL: status na goedkeuren is %', s; end if;
  if not (select is_published from listings where id = l_a) then raise exception 'FAIL: aanbod is niet gepubliceerd na goedkeuren'; end if;
  raise notice 'OK: goedgekeurd en aanbod gepubliceerd';

  if not exists (select 1 from notifications where user_id = u_a and title = 'Je aanmelding is goedgekeurd') then
    raise exception 'FAIL: geen melding voor de partner na goedkeuren';
  end if;
  raise notice 'OK: partner kreeg een melding';

  -- Beoordeling: opnieuw beoordelen, publiek zicht en blokkeren ---------------------
  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform approve_vendor(v_a);
    raise exception 'FAIL: tweede keer goedkeuren gelukt';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: een goedgekeurde partner opnieuw goedkeuren geweigerd (%)', sqlerrm;
  end;
  begin
    perform approve_vendor(v_b);
    raise exception 'FAIL: een concept-aanmelding kon worden goedgekeurd';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: een niet ingestuurde aanmelding kan niet worden beoordeeld (%)', sqlerrm;
  end;
  reset role;

  set local role anon;
  select count(*) into n from listings where id = l_a;
  if n <> 1 then raise exception 'FAIL: goedgekeurd aanbod is niet publiek zichtbaar'; end if;
  reset role;
  update vendors set status = 'suspended' where id = v_a;
  set local role anon;
  select count(*) into n from listings where id = l_a;
  if n <> 0 then raise exception 'FAIL: aanbod van een geblokkeerde partner is nog zichtbaar'; end if;
  reset role;

  -- Een geblokkeerde partner kan zijn bedrijfsgegevens niet wijzigen, een goedgekeurde partner wel
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update vendor_details set city = 'Geblokkeerd' where vendor_id = v_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: geblokkeerde partner kon bedrijfsgegevens wijzigen'; end if;
  reset role;
  update vendors set status = 'approved' where id = v_a;
  set local role authenticated;
  update vendor_details set city = 'Goedgekeurd' where vendor_id = v_a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: goedgekeurde partner kon bedrijfsgegevens niet wijzigen'; end if;
  reset role;
  raise notice 'OK: bedrijfsgegevens wijzigen mag na goedkeuren, niet bij blokkeren';
  raise notice 'OK: goedgekeurd aanbod is publiek zichtbaar en verdwijnt bij blokkeren';

  -- Afkeuren, aanpassen en opnieuw insturen (partner B) --------------------------
  l_b := gen_random_uuid();
  pfx_b := v_b::text || '/' || l_b::text || '/';
  insert into vendor_details (vendor_id, kvk, street, house_number, postal_code, city, phone, contact_email)
  values (v_b, '99999999', 'Dam', 2, '1012 JS', 'Amsterdam', '+31201234567', 'b@test.invalid');
  insert into listings (id, vendor_id, category, title, photos)
  values (l_b, v_b, 'dj', 'DJ B', array(select pfx_b || g || '.jpg' from generate_series(1, 5) g));
  insert into storage.objects (bucket_id, name) select 'listing-photos', pfx_b || g || '.jpg' from generate_series(1, 5) g;

  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform submit_vendor_for_review();
  begin
    perform reject_vendor(v_b, 'Ik keur mezelf af');
    raise exception 'FAIL: partner kon zichzelf afkeuren';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: partner kan zichzelf niet afkeuren (%)', sqlerrm;
  end;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform reject_vendor(v_b, '  KvK klopt niet  ');
  reset role;
  select status::text, rejection_reason into s, txt from vendors where id = v_b;
  if s <> 'rejected' or txt is distinct from 'KvK klopt niet' then raise exception 'FAIL: afkeuren gaf status % en reden %', s, txt; end if;
  if not exists (select 1 from notifications where user_id = u_b and title = 'Je aanmelding is niet goedgekeurd' and body = 'KvK klopt niet') then
    raise exception 'FAIL: geen melding met reden na afkeuren';
  end if;
  if (select is_published from listings where id = l_b) then raise exception 'FAIL: aanbod van een afgekeurde partner is gepubliceerd'; end if;
  raise notice 'OK: afgekeurd met reden en melding, aanbod blijft verborgen';

  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update vendor_details set city = 'Utrecht' where vendor_id = v_b;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: afgekeurde partner kan bedrijfsgegevens niet aanpassen'; end if;
  update listings set title = 'DJ B aangepast' where id = l_b;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: afgekeurde partner kan aanbod niet aanpassen'; end if;
  perform submit_vendor_for_review();
  reset role;
  select status::text, rejection_reason into s, txt from vendors where id = v_b;
  if s <> 'pending' or txt is not null then raise exception 'FAIL: opnieuw insturen gaf status % en reden %', s, txt; end if;
  raise notice 'OK: afgekeurde partner kan aanpassen en opnieuw insturen';

  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform approve_vendor(v_b);
  reset role;
  if not (select is_published from listings where id = l_b) then raise exception 'FAIL: aanbod van B niet gepubliceerd na goedkeuren'; end if;
  raise notice 'OK: na opnieuw insturen goedgekeurd en gepubliceerd';

  -- Akkoord op de voorwaarden bij het insturen (partner zonder vastgelegd akkoord) --------
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (u_w, 'oud@test.invalid', '{"role":"vendor","company_name":"Oud","category":"dj"}', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', u_w, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform submit_vendor_for_review();
    raise exception 'FAIL: insturen zonder akkoord op de voorwaarden gelukt';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: insturen zonder akkoord geweigerd (%)', sqlerrm;
  end;

  perform accept_partner_terms('2026-10-17');
  perform accept_partner_terms('andere-versie');
  reset role;
  select terms_version into txt from vendors where owner_id = u_w;
  if txt is distinct from '2026-10-17' then raise exception 'FAIL: akkoord is overschreven of niet vastgelegd (%)', txt; end if;
  if (select terms_accepted_at is null from vendors where owner_id = u_w) then raise exception 'FAIL: tijdstip van akkoord ontbreekt'; end if;

  set local role authenticated;
  begin
    perform submit_vendor_for_review();
    raise exception 'FAIL: insturen zonder bedrijfsgegevens gelukt';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    raise notice 'OK: na het akkoord gaat de controle door naar de volgende eis (%)', sqlerrm;
  end;
  reset role;
  raise notice 'OK: akkoord wordt eenmalig vastgelegd en niet overschreven';

  raise notice 'ALLE TESTS GESLAAGD';
end $$;

rollback;
