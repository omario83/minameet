-- Stap 5b: tijdens de beoordeling kan een partner zijn aanbod niet meer wijzigen, toevoegen of verwijderen.
-- Zonder dit kon het aanbod na het insturen nog veranderen, terwijl de admin juist dat aanbod beoordeelt.
-- Vereist 0008 en 0010.

create function guard_listing_review_lock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  vid uuid := coalesce(new.vendor_id, old.vendor_id);
begin
  if is_client() and exists (select 1 from vendors where id = vid and status = 'pending') then
    raise exception 'Je aanbod kan niet worden gewijzigd tijdens de beoordeling';
  end if;
  return coalesce(new, old);
end $$;

create trigger guard_listing_review_lock before insert or update or delete on listings
for each row execute function guard_listing_review_lock();
