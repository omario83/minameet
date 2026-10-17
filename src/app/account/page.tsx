import Link from "next/link";
import { QuoteResponse } from "@/components/customer/quote-response";
import { cancelRequest } from "@/lib/customer-actions";
import { eur, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "Aangevraagd", color: "bg-st-open" },
  quoted: { label: "Offerte ontvangen", color: "bg-st-sent" },
  accepted: { label: "Geboekt", color: "bg-st-won" },
  declined: { label: "Afgewezen", color: "bg-st-lost" },
  cancelled: { label: "Geannuleerd", color: "bg-st-expired" },
};

type QuoteRow = {
  id: string;
  status: string;
  total_cents: number;
  valid_until: string | null;
  note: string | null;
  sent_at: string | null;
  quote_items: { description: string; quantity: number; unit_price_cents: number }[];
};

export default async function AccountPage() {
  const supabase = await createClient();
  const [{ data: requests }, { data: notifications }] = await Promise.all([
    supabase
      .from("quote_requests")
      .select("id, event_type, event_date, guest_count, status, created_at, vendors(company_name), listings(title), quotes(id, status, total_cents, valid_until, note, sent_at, quote_items(description, quantity, unit_price_cents))")
      .order("created_at", { ascending: false }),
    supabase.from("notifications").select("id, title, body, link").is("read_at", null).order("created_at", { ascending: false }).limit(5),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Mijn feest</h1>
        <Link href="/zoeken" className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110">
          Aanbieders zoeken
        </Link>
      </div>

      {notifications && notifications.length > 0 && (
        <ul className="mb-6 space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className="rounded-2xl bg-gold/30 px-5 py-3 text-sm">
              <span className="font-semibold">{n.title}</span>
              {n.body && <span className="text-ink/70"> · {n.body}</span>}
            </li>
          ))}
        </ul>
      )}

      {!requests?.length ? (
        <p className="rounded-3xl bg-white p-8 text-ink/60">
          Je hebt nog geen offerteaanvragen. <Link href="/zoeken" className="font-semibold text-brand">Begin met zoeken</Link>
        </p>
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => {
            const status = STATUS[r.status];
            const vendor = r.vendors as unknown as { company_name: string } | null;
            const listing = r.listings as unknown as { title: string } | null;
            const quotes = ((r.quotes ?? []) as unknown as QuoteRow[]).sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""));
            const quote = quotes[0];
            const expired = quote?.valid_until && quote.valid_until < today;

            return (
              <li key={r.id} className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold">{listing?.title ?? "Aanvraag"}</h2>
                    <p className="text-sm text-ink/60">
                      {vendor?.company_name} · {r.event_type ?? "Feest"} · {formatDate(r.event_date)}
                      {r.guest_count ? ` · ${r.guest_count} gasten` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${status.color}`}>{status.label}</span>
                </div>

                {quote && quote.status !== "draft" && (
                  <div className="mt-4 rounded-2xl bg-brand-soft p-4">
                    <table className="w-full text-sm">
                      <tbody>
                        {quote.quote_items.map((i, idx) => (
                          <tr key={idx}>
                            <td className="py-1">{i.description}</td>
                            <td className="py-1 text-right text-ink/60">{i.quantity} × {eur(i.unit_price_cents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 flex justify-between border-t border-ink/10 pt-3 font-display text-lg font-bold">
                      <span>Totaal</span>
                      <span>{eur(quote.total_cents)}</span>
                    </p>
                    {quote.note && <p className="mt-2 text-sm text-ink/70">{quote.note}</p>}
                    {quote.valid_until && (
                      <p className={`mt-2 text-xs ${expired ? "text-st-lost" : "text-ink/50"}`}>
                        {expired ? "Verlopen op" : "Geldig tot"} {formatDate(quote.valid_until)}
                      </p>
                    )}
                    {quote.status === "sent" && !expired && <QuoteResponse quoteId={quote.id} />}
                  </div>
                )}

                {(r.status === "open" || r.status === "quoted") && (
                  <form action={cancelRequest} className="mt-3">
                    <input type="hidden" name="request_id" value={r.id} />
                    <button className="text-sm text-ink/50 underline hover:text-st-lost">Aanvraag annuleren</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
