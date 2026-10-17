import Link from "next/link";
import { CalendarFeedForm } from "@/components/agenda/calendar-feed-form";
import { OpeningHoursForm } from "@/components/agenda/opening-hours-form";
import { loadFeed, loadOpeningHours } from "@/lib/agenda/queries";
import { getVendor } from "@/lib/vendor";

export default async function SetupCalendarPage() {
  const { supabase, vendor } = await getVendor();
  const [opening, feed] = await Promise.all([loadOpeningHours(supabase, vendor.id), loadFeed(supabase, vendor.id)]);

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Je agenda</h1>
      <p className="mt-2 text-ink/70">Stel je openingstijden in en koppel eventueel je eigen kalender.</p>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-display text-xl font-bold">Eigen kalender koppelen (optioneel)</h2>
        <CalendarFeedForm feed={feed ? { host: feed.host, lastSyncedAt: feed.lastSyncedAt, lastError: feed.lastError } : null} />
      </section>

      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-display text-xl font-bold">Openingstijden</h2>
        <OpeningHoursForm initial={opening} setup />
      </section>

      <p className="mt-5">
        <Link href="/leverancier/start/bedrijf" className="text-sm font-semibold text-brand underline">
          Overslaan
        </Link>
      </p>
    </>
  );
}
