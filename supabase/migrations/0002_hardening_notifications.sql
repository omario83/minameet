-- Aanscherping, contactgegevens en notificaties

alter table quote_requests add column contact_name text, add column contact_phone text;

-- Waar is de aanroeper een gewone app-gebruiker (geen SQL-editor/service/definer-functie)?
create function is_client() returns boolean
language sql stable as $$ select current_user in ('authenticated', 'anon') $$;

create or replace function guard_profile_update() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and is_client() and coalesce(auth_role()::text, '') <> 'admin' then
    raise exception 'Rol kan niet worden gewijzigd';
  end if;
  return new;
end $$;

create or replace function guard_vendor_update() returns trigger
language plpgsql as $$
begin
  if (new.commission_pct is distinct from old.commission_pct
      or new.status is distinct from old.status
      or new.owner_id is distinct from old.owner_id)
     and is_client() and coalesce(auth_role()::text, '') <> 'admin' then
    raise exception 'Alleen een admin kan commissie of status wijzigen';
  end if;
  return new;
end $$;

-- Aanvragen: klant mag annuleren, leverancier mag een open aanvraag afwijzen, verder niets.
create function guard_request_insert() returns trigger
language plpgsql as $$
begin
  if not is_client() then return new; end if;
  if new.status <> 'open' then raise exception 'Nieuwe aanvraag moet open zijn'; end if;
  if new.listing_id is not null and not exists (
    select 1 from listings l where l.id = new.listing_id and l.vendor_id = new.vendor_id
  ) then
    raise exception 'Ongeldig aanbod';
  end if;
  return new;
end $$;
create trigger guard_request_insert before insert on quote_requests
for each row execute function guard_request_insert();

create function guard_request_update() returns trigger
language plpgsql as $$
begin
  if not is_client() then return new; end if;
  if new.customer_id is distinct from old.customer_id
     or new.vendor_id is distinct from old.vendor_id
     or new.listing_id is distinct from old.listing_id
     or new.group_id is distinct from old.group_id
     or new.event_date is distinct from old.event_date then
    raise exception 'Deze velden kunnen niet worden gewijzigd';
  end if;
  if new.status is distinct from old.status then
    if not (
      (owns_vendor(old.vendor_id) and old.status = 'open' and new.status = 'declined')
      or (old.customer_id = auth.uid() and old.status in ('open', 'quoted') and new.status = 'cancelled')
    ) then
      raise exception 'Statuswijziging niet toegestaan';
    end if;
  end if;
  return new;
end $$;
create trigger guard_request_update before update on quote_requests
for each row execute function guard_request_update();

-- Offertes: leveranciers mogen alleen concept -> verstuurd; accepteren/afwijzen gaat via functies.
create function guard_quote_write() returns trigger
language plpgsql as $$
begin
  if not is_client() then return new; end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'Een nieuwe offerte moet een concept zijn'; end if;
    if not exists (
      select 1 from quote_requests r where r.id = new.request_id and r.vendor_id = new.vendor_id
    ) then
      raise exception 'Ongeldige aanvraag';
    end if;
    return new;
  end if;

  if new.request_id is distinct from old.request_id or new.vendor_id is distinct from old.vendor_id then
    raise exception 'Deze velden kunnen niet worden gewijzigd';
  end if;
  if new.status is distinct from old.status and not (old.status = 'draft' and new.status = 'sent') then
    raise exception 'Statuswijziging niet toegestaan';
  end if;
  if old.status <> 'draft' and (
    new.total_cents is distinct from old.total_cents
    or new.valid_until is distinct from old.valid_until
    or new.note is distinct from old.note
  ) then
    raise exception 'Een verstuurde offerte kan niet meer worden aangepast';
  end if;
  return new;
end $$;
create trigger guard_quote_write before insert or update on quotes
for each row execute function guard_quote_write();

-- Notificaties via triggers ---------------------------------------------

create or replace function on_quote_request_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into tasks (vendor_id, kind, request_id, due_at)
  values (new.vendor_id, 'answer_request', new.id, now() + interval '2 days');

  insert into notifications (user_id, title, body, link)
  select v.owner_id, 'Nieuwe offerteaanvraag', coalesce(new.event_type, 'Feest'), '/leverancier/aanvragen/' || new.id
  from vendors v where v.id = new.vendor_id;
  return new;
end $$;

create or replace function on_quote_sent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') then
    update tasks set done_at = now()
      where request_id = new.request_id and kind = 'answer_request' and done_at is null;
    update quote_requests set status = 'quoted'
      where id = new.request_id and status = 'open';
    insert into tasks (vendor_id, kind, request_id, quote_id, due_at)
    values (new.vendor_id, 'follow_up_quote', new.request_id, new.id, now() + interval '3 days');

    insert into notifications (user_id, title, body, link)
    select r.customer_id, 'Nieuwe offerte ontvangen', v.company_name, '/account'
    from quote_requests r, vendors v
    where r.id = new.request_id and v.id = new.vendor_id;
  end if;
  return new;
end $$;

create function on_quote_response() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'sent' and new.status in ('accepted', 'declined') then
    insert into notifications (user_id, title, link)
    select v.owner_id,
           case when new.status = 'accepted' then 'Offerte geaccepteerd' else 'Offerte afgewezen' end,
           '/leverancier/aanvragen/' || new.request_id
    from vendors v where v.id = new.vendor_id;
  end if;
  return new;
end $$;
create trigger on_quote_response after update of status on quotes
for each row execute function on_quote_response();
