-- Stap 7: agenda, openingstijden, koppeling met een externe kalender en de eerste-keer-instelling.
-- Vereist 0005 (en dus 0004).

-- Nieuwe partners doorlopen bij hun eerste inlog een instelassistent; bestaande partners niet.
alter table vendors add column setup_completed_at timestamptz;
update vendors set setup_completed_at = now() where status <> 'draft';

-- Openingstijden per weekdag (0 = maandag). Zonder rijen gelden de standaardtijden van de app.
create table vendor_opening_hours (
  vendor_id uuid not null references vendors(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_closed boolean not null default false,
  opens time not null default '08:00',
  closes time not null default '18:00',
  primary key (vendor_id, weekday),
  check (is_closed or opens < closes)
);

-- Eén externe kalender per partner (iCal-adres, alleen lezen). Het adres kan een geheime sleutel bevatten: alleen de eigenaar ziet het.
create table calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null unique references vendors(id) on delete cascade,
  url text not null check (url ~ '^https://' and length(url) <= 2000),
  label text check (length(label) <= 80),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create type agenda_kind as enum ('appointment', 'block', 'external');

create table agenda_items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  feed_id uuid references calendar_feeds(id) on delete cascade,
  kind agenda_kind not null default 'appointment',
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'completed')),
  title text not null check (length(trim(title)) between 1 and 120),
  customer_name text check (length(customer_name) <= 120),
  note text check (length(note) <= 1000),
  price_cents integer check (price_cents >= 0 and price_cents <= 100000000),
  all_day boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  external_uid text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '62 days')
);
create index on agenda_items (vendor_id, starts_at);
create index on agenda_items (feed_id) where feed_id is not null;

-- Aanbod en kalender moeten van dezelfde partner zijn.
create function guard_agenda_item() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.listing_id is not null
     and not exists (select 1 from listings l where l.id = new.listing_id and l.vendor_id = new.vendor_id) then
    raise exception 'Ongeldig aanbod';
  end if;
  if new.feed_id is not null
     and not exists (select 1 from calendar_feeds f where f.id = new.feed_id and f.vendor_id = new.vendor_id) then
    raise exception 'Ongeldige kalender';
  end if;
  return new;
end $$;

create trigger guard_agenda_item before insert or update on agenda_items
for each row execute function guard_agenda_item();

alter table vendor_opening_hours enable row level security;
alter table calendar_feeds enable row level security;
alter table agenda_items enable row level security;
revoke all on vendor_opening_hours, calendar_feeds, agenda_items from anon;

create policy opening_hours_select on vendor_opening_hours for select to authenticated
  using (owns_vendor(vendor_id) or auth_role() = 'admin');
create policy opening_hours_write on vendor_opening_hours for all to authenticated
  using (owns_vendor(vendor_id)) with check (owns_vendor(vendor_id));

create policy calendar_feeds_all on calendar_feeds for all to authenticated
  using (owns_vendor(vendor_id)) with check (owns_vendor(vendor_id));

create policy agenda_items_select on agenda_items for select to authenticated
  using (owns_vendor(vendor_id) or auth_role() = 'admin');
create policy agenda_items_write on agenda_items for all to authenticated
  using (owns_vendor(vendor_id)) with check (owns_vendor(vendor_id));
