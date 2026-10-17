import { AgendaScreen } from "@/components/agenda/agenda-view";
import { loadAgenda, loadFeed, loadListings, loadOpeningHours } from "@/lib/agenda/queries";
import { parseIsoDate, rangeFor, toLocal, type AgendaView } from "@/lib/agenda/time";
import { getVendor } from "@/lib/vendor";

const VIEWS: AgendaView[] = ["dag", "week", "maand"];
const STALE_MS = 15 * 60 * 1000;

export default async function AgendaPage({ searchParams }: PageProps<"/leverancier/agenda">) {
  const params = await searchParams;
  const { supabase, vendor } = await getVendor();

  const now = toLocal(new Date());
  const view = VIEWS.find((v) => v === params.weergave) ?? "week";
  const date = parseIsoDate(params.datum) ?? now.date;
  const range = rangeFor(view, date);

  const listings = await loadListings(supabase, vendor.id);
  const [events, opening, feed] = await Promise.all([
    loadAgenda(supabase, vendor.id, listings, range.from, range.to),
    loadOpeningHours(supabase, vendor.id),
    loadFeed(supabase, vendor.id),
  ]);

  const requestedListing = typeof params.aanbod === "string" ? params.aanbod : null;
  const listingFilter = listings.some((l) => l.id === requestedListing) ? requestedListing : null;
  const feedStale = !!feed && (!feed.lastSyncedAt || new Date().getTime() - new Date(feed.lastSyncedAt).getTime() > STALE_MS);

  return (
    <AgendaScreen
      view={view}
      date={date}
      today={now.date}
      nowMinutes={now.minutes}
      events={events}
      listings={listings}
      opening={opening}
      listingFilter={listingFilter}
      feed={feed ? { host: feed.host, lastSyncedAt: feed.lastSyncedAt, lastError: feed.lastError } : null}
      feedStale={feedStale}
    />
  );
}
