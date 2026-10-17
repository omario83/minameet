import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { QuoteEditor } from "@/components/vendor/quote-editor";
import { ReminderButton } from "@/components/vendor/reminder-button";
import { declineRequest } from "@/lib/crm-actions";
import { PRICE_SUFFIX, eur, formatDate } from "@/lib/format";
import { getVendor } from "@/lib/vendor";

function isoInDays(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

type QuoteRow = {
  id: string;
  status: string;
  total_cents: number;
  valid_until: string | null;
  note: string | null;
  sent_at: string | null;
  quote_items: { description: string; quantity: number; unit_price_cents: number }[];
};

export default async function RequestPage({ params }: PageProps<"/leverancier/aanvragen/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { supabase, vendor } = await getVendor();
  const { data: r } = await supabase
    .from("quote_requests")
    .select("id, event_type, event_date, guest_count, budget_cents, message, status, contact_name, contact_phone, listings(title, price_model, base_price_cents), quotes(id, status, total_cents, valid_until, note, sent_at, quote_items(description, quantity, unit_price_cents))")
    .eq("id", id)
    .eq("vendor_id", vendor.id)
    .single();
  if (!r) notFound();

  const listing = r.listings as unknown as { title: string; price_model: string; base_price_cents: number | null } | null;
  const quotes = ((r.quotes ?? []) as unknown as QuoteRow[]).sort((a, b) => (b.sent_at ?? "9").localeCompare(a.sent_at ?? "9"));
  const draft = quotes.find((q) => q.status === "draft");
  const current = draft ?? quotes[0];
  const closed = !["open", "quoted"].includes(r.status);

  const initialRows = draft
    ? draft.quote_items.map((i) => ({ description: i.description, quantity: String(i.quantity), price: String(i.unit_price_cents / 100) }))
    : listing && listing.base_price_cents != null
      ? [{
          description: listing.title,
          quantity: listing.price_model === "per_person" && r.guest_count ? String(r.guest_count) : "1",
          price: String(listing.base_price_cents / 100),
        }]
      : [];

  const inTwoWeeks = isoInDays(14);

  return (
    <>
      <Link href="/leverancier/dashboard" className="text-sm font-semibold text-brand">← Dashboard</Link>
      <h1 className="mt-2 font-display text-3xl font-bold">{r.event_type ?? "Offerteaanvraag"}</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_3fr]">
        <section className="h-fit rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-display text-lg font-bold">Aanvraag</h2>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs font-semibold uppercase text-ink/40">Aanbod</dt><dd>{listing?.title ?? "-"} {listing?.base_price_cents != null && <span className="text-ink/50">({eur(listing.base_price_cents)}{PRICE_SUFFIX[listing.price_model]})</span>}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-ink/40">Datum</dt><dd>{formatDate(r.event_date)}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-ink/40">Gasten</dt><dd>{r.guest_count ?? "-"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-ink/40">Budget</dt><dd>{r.budget_cents != null ? eur(r.budget_cents) : "-"}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-ink/40">Contact</dt><dd>{r.contact_name}{r.contact_phone ? ` · ${r.contact_phone}` : ""}</dd></div>
            {r.message && <div><dt className="text-xs font-semibold uppercase text-ink/40">Bericht</dt><dd className="whitespace-pre-line">{r.message}</dd></div>}
          </dl>
          {r.status === "open" && !draft && (
            <form action={declineRequest} className="mt-5">
              <input type="hidden" name="request_id" value={r.id} />
              <button className="text-sm text-ink/50 underline hover:text-st-lost">Aanvraag afwijzen</button>
            </form>
          )}
        </section>

        <section>
          {closed && !current ? (
            <p className="rounded-3xl bg-white p-6 text-ink/60">Deze aanvraag is afgesloten ({r.status}).</p>
          ) : !current || current.status === "draft" || (current.status === "expired" && !closed) ? (
            <QuoteEditor
              requestId={r.id}
              quoteId={draft?.id ?? ""}
              initialRows={initialRows}
              validUntil={draft?.valid_until ?? inTwoWeeks}
              note={draft?.note ?? ""}
            />
          ) : (
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold">Offerte {current.status === "sent" ? "verstuurd" : current.status}</h2>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {current.quote_items.map((i, idx) => (
                    <tr key={idx}><td className="py-1">{i.description}</td><td className="py-1 text-right text-ink/60">{i.quantity} × {eur(i.unit_price_cents)}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 flex justify-between border-t border-ink/10 pt-3 font-display text-lg font-bold"><span>Totaal</span><span>{eur(current.total_cents)}</span></p>
              {current.status === "sent" && (
                <div className="mt-5"><ReminderButton quoteId={current.id} /></div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
