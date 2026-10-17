import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { StatusBanner } from "@/components/vendor/status-banner";
import { SubmitForReview } from "@/components/vendor/submit-for-review";
import { eur } from "@/lib/format";
import { getOnboarding } from "@/lib/onboarding";
import { STEP_PATH, checklist, isComplete } from "@/lib/onboarding-steps";
import { formatPhone } from "@/lib/schemas/vendor-details";

export default async function SubmitPage() {
  const { vendor, details, listings, state } = await getOnboarding();
  const items = checklist(state);
  const ready = isComplete(state);

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Insturen ter controle</h1>
      <p className="mb-6 mt-1 text-ink/60">
        MinaMeet controleert je gegevens en laat je per e-mail weten of je wordt goedgekeurd. Na het insturen kun je je bedrijfsgegevens en je aanbod niet meer zelf wijzigen.
      </p>
      <StatusBanner vendor={vendor} />

      <ul className="mt-6 max-w-xl space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-3 rounded-2xl bg-white px-5 py-3 shadow-sm">
            {item.done ? <Check aria-hidden className="size-5 text-st-won" /> : <Circle aria-hidden className="size-5 text-st-expired" />}
            <span className={item.done ? "" : "text-ink/60"}>{item.label}</span>
          </li>
        ))}
      </ul>

      {!ready && (
        <p className="mt-4 text-sm">
          <Link href="/leverancier/aanmelden" className="font-semibold text-brand underline">
            Ga naar de stap die nog ontbreekt
          </Link>
        </p>
      )}

      <h2 className="mb-3 mt-10 font-display text-xl font-bold">Dit sturen we in</h2>
      <div className="grid max-w-3xl gap-4">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-lg font-bold">{vendor.company_name}</p>
              {details ? (
                <p className="mt-1 text-sm text-ink/70">
                  KvK {details.kvk} · {details.street} {details.house_number}
                  {details.house_number_addition ? ` ${details.house_number_addition}` : ""}, {details.postal_code} {details.city}
                  <br />
                  {formatPhone(details.phone)} · {details.contact_email}
                </p>
              ) : (
                <p className="mt-1 text-sm text-ink/60">Nog geen bedrijfsgegevens.</p>
              )}
            </div>
            <Link href={STEP_PATH.bedrijfsgegevens} className="shrink-0 text-sm font-semibold text-brand underline">
              Wijzigen
            </Link>
          </div>
        </section>

        {listings.map((l) => (
          <section key={l.id} className="flex items-start justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm">
            <div>
              <p className="font-display text-lg font-bold">{l.title}</p>
              <p className="mt-1 text-sm text-ink/70">
                {eur(l.base_price_cents)} · {l.min_guests ?? "?"} tot {l.max_guests ?? "?"} gasten · {(l.photos as string[]).length} foto&apos;s
              </p>
            </div>
            <Link href={STEP_PATH.aanbod} className="shrink-0 text-sm font-semibold text-brand underline">
              Wijzigen
            </Link>
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <SubmitForReview ready={ready} needsTerms={!vendor.terms_accepted_at} />
        <Link href={STEP_PATH.aanbod} className="text-sm font-semibold text-brand underline">
          Terug naar aanbod
        </Link>
      </div>
    </>
  );
}
