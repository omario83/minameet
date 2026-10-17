import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgendaEvent, AgendaListing, FeedInfo } from "@/lib/agenda/types";
import { DAY_MINUTES, zonedToUtc } from "@/lib/agenda/time";
import { DEFAULT_OPENING_HOURS, type OpeningDay } from "@/lib/schemas/agenda";

type ItemRow = {
  id: string;
  kind: "appointment" | "block" | "external";
  status: "pending" | "confirmed" | "completed";
  title: string;
  customer_name: string | null;
  note: string | null;
  price_cents: number | null;
  all_day: boolean;
  starts_at: string;
  ends_at: string;
  listing_id: string | null;
};

type BookingRow = {
  id: string;
  date: string;
  total_cents: number;
  listing_id: string | null;
  listings: { title: string } | null;
  quotes: { quote_requests: { contact_name: string | null; event_type: string | null } | null } | null;
};

export async function loadListings(supabase: SupabaseClient, vendorId: string): Promise<AgendaListing[]> {
  const { data } = await supabase.from("listings").select("id, title").eq("vendor_id", vendorId).order("created_at");
  return data ?? [];
}

/** Alles wat in de agenda van `from` (inclusief) tot `to` (exclusief) staat: eigen items, boekingen en dagen met een optie. */
export async function loadAgenda(
  supabase: SupabaseClient,
  vendorId: string,
  listings: AgendaListing[],
  from: string,
  to: string,
): Promise<AgendaEvent[]> {
  const fromUtc = zonedToUtc(from, 0).toISOString();
  const toUtc = zonedToUtc(to, 0).toISOString();
  const listingIds = listings.map((l) => l.id);
  const titleOf = new Map(listings.map((l) => [l.id, l.title]));

  const [items, bookings, availability] = await Promise.all([
    supabase
      .from("agenda_items")
      .select("id, kind, status, title, customer_name, note, price_cents, all_day, starts_at, ends_at, listing_id")
      .eq("vendor_id", vendorId)
      .lt("starts_at", toUtc)
      .gt("ends_at", fromUtc)
      .order("starts_at")
      .limit(2000),
    supabase
      .from("bookings")
      .select("id, date, total_cents, listing_id, listings(title), quotes(quote_requests(contact_name, event_type))")
      .eq("vendor_id", vendorId)
      .gte("date", from)
      .lt("date", to),
    listingIds.length
      ? supabase.from("availability").select("id, listing_id, date, status").in("listing_id", listingIds).gte("date", from).lt("date", to).neq("status", "free")
      : Promise.resolve({ data: [] as { id: string; listing_id: string; date: string; status: string }[] }),
  ]);

  const events: AgendaEvent[] = [];

  for (const row of (items.data ?? []) as ItemRow[]) {
    const external = row.kind === "external";
    events.push({
      id: row.id,
      source: "item",
      kind: row.kind,
      status: row.kind === "block" ? "blocked" : external ? "external" : row.status,
      title: row.title,
      subtitle: row.listing_id ? (titleOf.get(row.listing_id) ?? null) : null,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      allDay: row.all_day,
      priceCents: row.price_cents,
      listingId: row.listing_id,
      customerName: row.customer_name,
      note: row.note,
      editable: !external,
    });
  }

  const booked = new Set<string>();
  for (const row of (bookings.data ?? []) as unknown as BookingRow[]) {
    if (row.listing_id) booked.add(`${row.listing_id}|${row.date}`);
    const request = row.quotes?.quote_requests;
    events.push({
      id: row.id,
      source: "booking",
      kind: "booking",
      status: "confirmed",
      title: request?.contact_name ? `${request.contact_name}` : "Boeking via MinaMeet",
      subtitle: [row.listings?.title, request?.event_type].filter(Boolean).join(" · ") || null,
      startsAt: zonedToUtc(row.date, 0).toISOString(),
      endsAt: zonedToUtc(row.date, DAY_MINUTES).toISOString(),
      allDay: true,
      priceCents: row.total_cents,
      listingId: row.listing_id,
      customerName: request?.contact_name ?? null,
      note: null,
      editable: false,
    });
  }

  for (const row of availability.data ?? []) {
    if (booked.has(`${row.listing_id}|${row.date}`)) continue;
    const option = row.status === "option";
    events.push({
      id: row.id,
      source: "availability",
      kind: "availability",
      status: option ? "pending" : "confirmed",
      title: `${option ? "Optie" : "Geboekt"} · ${titleOf.get(row.listing_id) ?? "aanbod"}`,
      subtitle: null,
      startsAt: zonedToUtc(row.date, 0).toISOString(),
      endsAt: zonedToUtc(row.date, DAY_MINUTES).toISOString(),
      allDay: true,
      priceCents: null,
      listingId: row.listing_id,
      customerName: null,
      note: null,
      editable: false,
    });
  }

  return events;
}

export async function loadOpeningHours(supabase: SupabaseClient, vendorId: string): Promise<OpeningDay[]> {
  const { data } = await supabase.from("vendor_opening_hours").select("weekday, is_closed, opens, closes").eq("vendor_id", vendorId);
  const byDay = new Map((data ?? []).map((row) => [row.weekday as number, row]));
  return DEFAULT_OPENING_HOURS.map((fallback) => {
    const row = byDay.get(fallback.weekday);
    // Tijden komen uit de database als "08:00:00".
    return row ? { weekday: fallback.weekday, is_closed: row.is_closed, opens: String(row.opens).slice(0, 5), closes: String(row.closes).slice(0, 5) } : fallback;
  });
}

export async function loadFeed(supabase: SupabaseClient, vendorId: string): Promise<(FeedInfo & { id: string }) | null> {
  const { data } = await supabase.from("calendar_feeds").select("id, url, last_synced_at, last_error").eq("vendor_id", vendorId).maybeSingle();
  if (!data) return null;
  let host = "externe kalender";
  try {
    host = new URL(data.url).hostname;
  } catch {
    // Onleesbaar adres: de standaardnaam blijft.
  }
  return { id: data.id, host, lastSyncedAt: data.last_synced_at, lastError: data.last_error };
}
