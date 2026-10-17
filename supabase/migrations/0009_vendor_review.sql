-- Stap 6: goedkeuren en afkeuren door een admin. Vereist 0008.

-- Goedkeuren en publiceren van het aanbod gaan samen in één transactie, anders blijft
-- het aanbod onzichtbaar (RLS vraagt is_published én status 'approved').
create function approve_vendor(p_vendor_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v vendors;
begin
  if coalesce(auth_role()::text, '') <> 'admin' then raise exception 'Geen toegang'; end if;

  select * into v from vendors where id = p_vendor_id for update;
  if not found then raise exception 'Partner niet gevonden'; end if;
  if v.status <> 'pending' then raise exception 'Alleen ingestuurde aanmeldingen kunnen worden beoordeeld'; end if;

  update vendors set status = 'approved', reviewed_at = now(), rejection_reason = null where id = v.id;
  update listings set is_published = true where vendor_id = v.id;
end $$;

create function reject_vendor(p_vendor_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v vendors;
  reason text := nullif(trim(p_reason), '');
begin
  if coalesce(auth_role()::text, '') <> 'admin' then raise exception 'Geen toegang'; end if;
  if reason is null then raise exception 'Geef een reden op'; end if;
  if length(reason) > 1000 then raise exception 'De reden is te lang'; end if;

  select * into v from vendors where id = p_vendor_id for update;
  if not found then raise exception 'Partner niet gevonden'; end if;
  if v.status <> 'pending' then raise exception 'Alleen ingestuurde aanmeldingen kunnen worden beoordeeld'; end if;

  update vendors set status = 'rejected', reviewed_at = now(), rejection_reason = reason where id = v.id;
end $$;

revoke all on function approve_vendor(uuid), reject_vendor(uuid, text) from public, anon;
grant execute on function approve_vendor(uuid), reject_vendor(uuid, text) to authenticated;

-- Melding in het portaal bij de uitkomst van de beoordeling.
create function on_vendor_reviewed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into notifications (user_id, title, body, link)
    values (
      new.owner_id,
      case when new.status = 'approved' then 'Je aanmelding is goedgekeurd' else 'Je aanmelding is niet goedgekeurd' end,
      new.rejection_reason,
      '/leverancier/dashboard'
    );
  end if;
  return new;
end $$;
create trigger on_vendor_reviewed after update of status on vendors
for each row execute function on_vendor_reviewed();
