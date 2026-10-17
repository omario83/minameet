import "server-only";
import { lookup } from "node:dns/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPrivateAddress, normalizeFeedUrl } from "@/lib/agenda/feed-url";
import { parseIcs } from "@/lib/agenda/ics";

/** Fout met een melding die de partner mag lezen. */
export class FeedError extends Error {}

const TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const PAST_DAYS = 31;
const FUTURE_DAYS = 400;
const MAX_SPAN_MS = 61 * 86_400_000;

async function assertPublicHost(hostname: string) {
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new FeedError("Dit adres is niet te bereiken");
  }
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new FeedError("Dit adres is niet toegestaan");
}

async function readCapped(res: Response) {
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new FeedError("Het kalenderbestand is te groot");
  const reader = res.body?.getReader();
  if (!reader) return res.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new FeedError("Het kalenderbestand is te groot");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Haalt het iCal-bestand op. Elk adres (ook na een doorverwijzing) wordt gecontroleerd op publiek bereikbaar. */
export async function fetchFeedText(url: string) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const checked = normalizeFeedUrl(current);
    if (!checked.ok) throw new FeedError(checked.error);
    await assertPublicHost(new URL(checked.url).hostname);

    let res: Response;
    try {
      res = await fetch(checked.url, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "text/calendar, text/plain;q=0.8, */*;q=0.5", "User-Agent": "MinaMeet/1.0" },
      });
    } catch {
      throw new FeedError("De kalender reageerde niet. Probeer het later opnieuw");
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new FeedError("De kalender stuurt je door naar een onbekend adres");
      current = new URL(location, checked.url).toString();
      continue;
    }
    if (!res.ok) throw new FeedError(`De kalender antwoordde met fout ${res.status}. Controleer het adres`);
    return readCapped(res);
  }
  throw new FeedError("De kalender stuurt je te vaak door");
}

/** Leest de externe kalender en vervangt de eerder geïmporteerde afspraken. Geeft het aantal afspraken terug. */
export async function syncFeed(supabase: SupabaseClient, vendorId: string, feed: { id: string; url: string }): Promise<number> {
  const now = Date.now();
  try {
    const text = await fetchFeedText(feed.url);

    let events;
    try {
      events = parseIcs(text, { from: new Date(now - PAST_DAYS * 86_400_000), to: new Date(now + FUTURE_DAYS * 86_400_000) });
    } catch {
      throw new FeedError("Dit is geen geldig iCal-bestand. Gebruik het iCal-adres uit je kalender-app");
    }

    const rows = events.map((e) => ({
      vendor_id: vendorId,
      feed_id: feed.id,
      kind: "external" as const,
      status: "confirmed" as const,
      title: e.title,
      all_day: e.allDay,
      starts_at: e.startsAt.toISOString(),
      // De database staat maximaal 62 dagen per item toe.
      ends_at: new Date(Math.min(e.endsAt.getTime(), e.startsAt.getTime() + MAX_SPAN_MS)).toISOString(),
      external_uid: e.uid,
    }));

    const removed = await supabase.from("agenda_items").delete().eq("feed_id", feed.id);
    if (removed.error) throw new FeedError("Opslaan is niet gelukt");
    for (let i = 0; i < rows.length; i += 500) {
      const inserted = await supabase.from("agenda_items").insert(rows.slice(i, i + 500));
      if (inserted.error) throw new FeedError("Opslaan is niet gelukt");
    }

    await supabase.from("calendar_feeds").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", feed.id);
    return rows.length;
  } catch (error) {
    const message = error instanceof FeedError ? error.message : "Synchroniseren is niet gelukt";
    await supabase.from("calendar_feeds").update({ last_error: message }).eq("id", feed.id);
    throw error instanceof FeedError ? error : new FeedError(message);
  }
}
