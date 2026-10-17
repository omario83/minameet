import { CalendarFeedForm } from "@/components/agenda/calendar-feed-form";
import { OpeningHoursForm } from "@/components/agenda/opening-hours-form";
import { DetailsForm } from "@/components/vendor/details-form";
import { ProfileForm } from "@/components/vendor/profile-form";
import { loadFeed, loadOpeningHours } from "@/lib/agenda/queries";
import { formatPhone } from "@/lib/schemas/vendor-details";
import { getVendor } from "@/lib/vendor";

export default async function VendorProfilePage() {
  const { supabase, vendor } = await getVendor();
  const [{ data: details }, opening, feed] = await Promise.all([
    supabase
      .from("vendor_details")
      .select("kvk, vat_number, street, house_number, house_number_addition, postal_code, city, phone, website, contact_email")
      .eq("vendor_id", vendor.id)
      .maybeSingle(),
    loadOpeningHours(supabase, vendor.id),
    loadFeed(supabase, vendor.id),
  ]);

  // Dezelfde regels als in de database: niet tijdens de beoordeling en niet voor een geblokkeerde partner.
  const locked = vendor.status === "pending" || vendor.status === "suspended";
  const lockedReason =
    vendor.status === "pending"
      ? "Je aanmelding wordt beoordeeld; je bedrijfsgegevens zijn tijdelijk vergrendeld."
      : "Je account is geblokkeerd. Neem contact op met MinaMeet om je gegevens te wijzigen.";

  return (
    <>
      <h1 className="mb-6 font-display text-3xl font-bold">Instellingen</h1>
      <div className="max-w-2xl space-y-10">
        <ProfileForm vendor={vendor} />

        <section>
          <h2 className="mb-1 font-display text-xl font-bold">Openingstijden</h2>
          <p className="mb-3 text-sm text-ink/60">In je agenda zijn gesloten dagen niet te boeken en grijs gearceerd.</p>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <OpeningHoursForm initial={opening} />
          </div>
        </section>

        <section>
          <h2 className="mb-1 font-display text-xl font-bold">Eigen kalender koppelen</h2>
          <p className="mb-3 text-sm text-ink/60">Afspraken uit je eigen agenda verschijnen als bezet in je MinaMeet-agenda.</p>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <CalendarFeedForm feed={feed ? { host: feed.host, lastSyncedAt: feed.lastSyncedAt, lastError: feed.lastError } : null} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-bold">Bedrijfsgegevens</h2>
          {!locked ? (
            <DetailsForm defaults={details ?? {}} />
          ) : details ? (
            <dl className="grid gap-3 rounded-3xl bg-white p-6 text-sm shadow-sm sm:grid-cols-2">
              {(
                [
                  ["KvK-nummer", details.kvk],
                  ["Btw-nummer", details.vat_number],
                  ["Adres", `${details.street} ${details.house_number}${details.house_number_addition ? ` ${details.house_number_addition}` : ""}, ${details.postal_code} ${details.city}`],
                  ["Telefoon", formatPhone(details.phone)],
                  ["E-mail", details.contact_email],
                  ["Website", details.website],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-ink/50">{label}</dt>
                  <dd className="font-medium">{value ?? "-"}</dd>
                </div>
              ))}
              <p className="text-xs text-ink/50 sm:col-span-2">{lockedReason}</p>
            </dl>
          ) : (
            <p className="rounded-3xl bg-white p-6 text-sm text-ink/60">Nog geen bedrijfsgegevens bekend.</p>
          )}
        </section>
      </div>
    </>
  );
}
