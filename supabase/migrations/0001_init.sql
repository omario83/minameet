-- MinaMeet: basisschema, rollen en RLS

create type user_role as enum ('customer', 'vendor', 'admin');
create type vendor_status as enum ('pending', 'approved', 'suspended');
create type listing_category as enum ('venue', 'catering', 'dj', 'photographer', 'decor', 'other');
create type price_model as enum ('fixed', 'per_person', 'per_hour', 'from');
create type availability_status as enum ('free', 'option', 'booked');
create type request_status as enum ('open', 'quoted', 'accepted', 'declined', 'cancelled');
create type quote_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired');
create type task_kind as enum ('answer_request', 'follow_up_quote');

-- Tabellen ------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references profiles(id) on delete cascade,
  company_name text not null,
  slug text not null unique,
  description text,
  city text,
  region text,
  logo_url text,
  cultural_tags text[] not null default '{}',
  commission_pct numeric(4,2) not null default 10 check (commission_pct between 0 and 50),
  status vendor_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  category listing_category not null,
  title text not null,
  description text,
  price_model price_model not null default 'fixed',
  base_price_cents integer check (base_price_cents >= 0),
  min_guests integer check (min_guests >= 0),
  max_guests integer check (max_guests >= 0),
  -- Categoriespecifieke velden; schema's staan in src/lib/categories.
  attributes jsonb not null default '{}',
  photos text[] not null default '{}',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create index on listings (vendor_id);
create index on listings (category) where is_published;

create table availability (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  date date not null,
  status availability_status not null,
  note text,
  unique (listing_id, date)
);

create table quote_requests (
  id uuid primary key default gen_random_uuid(),
  -- Eén formulier naar meerdere leveranciers: één rij per leverancier, gedeeld group_id.
  group_id uuid not null default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  event_type text,
  event_date date,
  guest_count integer check (guest_count > 0),
  budget_cents integer check (budget_cents >= 0),
  message text,
  status request_status not null default 'open',
  created_at timestamptz not null default now()
);
create index on quote_requests (vendor_id, status);
create index on quote_requests (customer_id);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references quote_requests(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  status quote_status not null default 'draft',
  total_cents integer not null default 0 check (total_cents >= 0),
  valid_until date,
  note text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index on quotes (vendor_id, status);
create index on quotes (request_id);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0)
);
create index on quote_items (quote_id);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  kind task_kind not null,
  request_id uuid references quote_requests(id) on delete cascade,
  quote_id uuid references quotes(id) on delete cascade,
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index on tasks (vendor_id) where done_at is null;

create table reminders (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  send_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index on reminders (send_at) where sent_at is null;

create table bookings (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references quotes(id),
  listing_id uuid references listings(id),
  customer_id uuid not null references profiles(id),
  vendor_id uuid not null references vendors(id),
  date date,
  total_cents integer not null,
  commission_pct numeric(4,2) not null,
  commission_cents integer not null,
  created_at timestamptz not null default now(),
  -- Voorkomt dubbele boekingen van dezelfde zaal/dienst op dezelfde dag.
  unique (listing_id, date)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id) where read_at is null;

-- Hulpfuncties ----------------------------------------------------------

create function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create function owns_vendor(vid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vendors where id = vid and owner_id = auth.uid())
$$;

-- Nieuwe gebruiker: profiel (en bij leveranciers een bedrijfsrij) aanmaken.
-- Rol 'admin' kan nooit via signup-metadata worden gezet.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_role user_role := case when new.raw_user_meta_data->>'role' = 'vendor' then 'vendor' else 'customer' end;
  company text := nullif(trim(new.raw_user_meta_data->>'company_name'), '');
begin
  insert into profiles (id, role, full_name)
  values (new.id, new_role, new.raw_user_meta_data->>'full_name');

  if new_role = 'vendor' then
    insert into vendors (owner_id, company_name, slug)
    values (
      new.id,
      coalesce(company, 'Nieuwe leverancier'),
      trim(both '-' from regexp_replace(lower(coalesce(company, 'leverancier')), '[^a-z0-9]+', '-', 'g'))
        || '-' || substr(replace(new.id::text, '-', ''), 1, 6)
    );
  end if;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- Beschermt velden die alleen een admin mag wijzigen.
create function guard_profile_update() returns trigger
language plpgsql as $$
begin
  if new.role is distinct from old.role and coalesce(auth_role()::text, '') <> 'admin' then
    raise exception 'Rol kan niet worden gewijzigd';
  end if;
  return new;
end $$;
create trigger guard_profile_update before update on profiles
for each row execute function guard_profile_update();

create function guard_vendor_update() returns trigger
language plpgsql as $$
begin
  if (new.commission_pct is distinct from old.commission_pct
      or new.status is distinct from old.status
      or new.owner_id is distinct from old.owner_id)
     and coalesce(auth_role()::text, '') <> 'admin' then
    raise exception 'Alleen een admin kan commissie of status wijzigen';
  end if;
  return new;
end $$;
create trigger guard_vendor_update before update on vendors
for each row execute function guard_vendor_update();

-- CRM-taken automatisch aanmaken ---------------------------------------

create function on_quote_request_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into tasks (vendor_id, kind, request_id, due_at)
  values (new.vendor_id, 'answer_request', new.id, now() + interval '2 days');
  return new;
end $$;
create trigger on_quote_request_created after insert on quote_requests
for each row execute function on_quote_request_created();

create function on_quote_sent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') then
    update tasks set done_at = now()
      where request_id = new.request_id and kind = 'answer_request' and done_at is null;
    update quote_requests set status = 'quoted'
      where id = new.request_id and status = 'open';
    insert into tasks (vendor_id, kind, request_id, quote_id, due_at)
    values (new.vendor_id, 'follow_up_quote', new.request_id, new.id, now() + interval '3 days');
  end if;
  return new;
end $$;
create trigger on_quote_sent after insert or update of status on quotes
for each row execute function on_quote_sent();

-- Offerte accepteren / afwijzen (klant) --------------------------------

create function accept_quote(p_quote_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  q quotes;
  r quote_requests;
  v vendors;
  booking_id uuid;
begin
  select * into q from quotes where id = p_quote_id for update;
  if not found then raise exception 'Offerte niet gevonden'; end if;

  select * into r from quote_requests where id = q.request_id;
  if r.customer_id is distinct from auth.uid() then raise exception 'Geen toegang'; end if;
  if q.status <> 'sent' then raise exception 'Deze offerte kan niet meer worden geaccepteerd'; end if;
  if q.valid_until is not null and q.valid_until < current_date then
    raise exception 'Deze offerte is verlopen';
  end if;

  select * into v from vendors where id = q.vendor_id;

  if r.listing_id is not null and r.event_date is not null then
    if exists (
      select 1 from availability
      where listing_id = r.listing_id and date = r.event_date and status = 'booked'
    ) then
      raise exception 'Deze datum is niet meer beschikbaar';
    end if;
    insert into availability (listing_id, date, status)
    values (r.listing_id, r.event_date, 'booked')
    on conflict (listing_id, date) do update set status = 'booked';
  end if;

  insert into bookings (quote_id, listing_id, customer_id, vendor_id, date, total_cents, commission_pct, commission_cents)
  values (
    q.id, r.listing_id, r.customer_id, q.vendor_id, r.event_date, q.total_cents,
    v.commission_pct, round(q.total_cents * v.commission_pct / 100)
  )
  returning id into booking_id;

  update quotes set status = 'accepted', responded_at = now() where id = q.id;
  update quote_requests set status = 'accepted' where id = r.id;
  update tasks set done_at = now() where quote_id = q.id and done_at is null;

  return booking_id;
end $$;

create function decline_quote(p_quote_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  q quotes;
  r quote_requests;
begin
  select * into q from quotes where id = p_quote_id for update;
  if not found then raise exception 'Offerte niet gevonden'; end if;

  select * into r from quote_requests where id = q.request_id;
  if r.customer_id is distinct from auth.uid() then raise exception 'Geen toegang'; end if;
  if q.status <> 'sent' then raise exception 'Deze offerte kan niet meer worden afgewezen'; end if;

  update quotes set status = 'declined', responded_at = now() where id = q.id;
  update quote_requests set status = 'declined' where id = r.id;
  update tasks set done_at = now() where quote_id = q.id and done_at is null;
end $$;

revoke all on function accept_quote(uuid), decline_quote(uuid) from public, anon;
grant execute on function accept_quote(uuid), decline_quote(uuid) to authenticated;

-- Row Level Security ------------------------------------------------------

alter table profiles enable row level security;
alter table vendors enable row level security;
alter table listings enable row level security;
alter table availability enable row level security;
alter table quote_requests enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table tasks enable row level security;
alter table reminders enable row level security;
alter table bookings enable row level security;
alter table notifications enable row level security;

-- profiles
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or auth_role() = 'admin');
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or auth_role() = 'admin');

-- vendors: goedgekeurde leveranciers zijn publiek zichtbaar
create policy vendors_select on vendors for select
  using (status = 'approved' or owner_id = auth.uid() or auth_role() = 'admin');
create policy vendors_update on vendors for update to authenticated
  using (owner_id = auth.uid() or auth_role() = 'admin');

-- listings
create policy listings_select on listings for select
  using (
    (is_published and exists (select 1 from vendors v where v.id = vendor_id and v.status = 'approved'))
    or owns_vendor(vendor_id) or auth_role() = 'admin'
  );
create policy listings_write on listings for all to authenticated
  using (owns_vendor(vendor_id)) with check (owns_vendor(vendor_id));

-- availability: zichtbaar als de listing zichtbaar is
create policy availability_select on availability for select
  using (exists (select 1 from listings l where l.id = listing_id));
create policy availability_write on availability for all to authenticated
  using (exists (select 1 from listings l where l.id = listing_id and owns_vendor(l.vendor_id)))
  with check (exists (select 1 from listings l where l.id = listing_id and owns_vendor(l.vendor_id)));

-- quote_requests
create policy requests_select on quote_requests for select to authenticated
  using (customer_id = auth.uid() or owns_vendor(vendor_id) or auth_role() = 'admin');
create policy requests_insert on quote_requests for insert to authenticated
  with check (
    customer_id = auth.uid() and auth_role() = 'customer'
    and exists (select 1 from vendors v where v.id = vendor_id and v.status = 'approved')
  );
create policy requests_update_customer on quote_requests for update to authenticated
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy requests_update_vendor on quote_requests for update to authenticated
  using (owns_vendor(vendor_id)) with check (owns_vendor(vendor_id));

-- quotes: klant ziet alleen verstuurde offertes; accepteren gaat via accept_quote()
create policy quotes_select on quotes for select to authenticated
  using (
    owns_vendor(vendor_id) or auth_role() = 'admin'
    or (status <> 'draft' and exists (
      select 1 from quote_requests r where r.id = request_id and r.customer_id = auth.uid()
    ))
  );
create policy quotes_write on quotes for all to authenticated
  using (owns_vendor(vendor_id)) with check (owns_vendor(vendor_id));

create policy quote_items_select on quote_items for select to authenticated
  using (exists (select 1 from quotes q where q.id = quote_id));
create policy quote_items_write on quote_items for all to authenticated
  using (exists (select 1 from quotes q where q.id = quote_id and q.status = 'draft' and owns_vendor(q.vendor_id)))
  with check (exists (select 1 from quotes q where q.id = quote_id and q.status = 'draft' and owns_vendor(q.vendor_id)));

-- tasks en reminders: alleen de leverancier
create policy tasks_all on tasks for all to authenticated
  using (owns_vendor(vendor_id)) with check (owns_vendor(vendor_id));
create policy reminders_all on reminders for all to authenticated
  using (owns_vendor(vendor_id)) with check (owns_vendor(vendor_id));

-- bookings: alleen lezen, aanmaken gaat via accept_quote()
create policy bookings_select on bookings for select to authenticated
  using (customer_id = auth.uid() or owns_vendor(vendor_id) or auth_role() = 'admin');

-- notifications
create policy notifications_select on notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on notifications for update to authenticated
  using (user_id = auth.uid());
