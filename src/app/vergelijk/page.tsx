import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CATEGORIES } from "@/lib/categories";
import { PRICE_SUFFIX, estimateTotal, eur, formatDate } from "@/lib/format";
import { FIELDS, type CategoryDb, type FieldDef } from "@/lib/listing-fields";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

const toArray = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default function ComparePage({ searchParams }: PageProps<"/vergelijk">) {
  return (
    <Suspense fallback={<p className="p-10 text-ink/60">Laden…</p>}>
      <Comparison searchParams={searchParams} />
    </Suspense>
  );
}

async function Comparison({ searchParams }: { searchParams: PageProps<"/vergelijk">["searchParams"] }) {
  const sp = await searchParams;
  const ids = [...new Set(toArray(sp.id))].filter((i) => z.uuid().safeParse(i).success).slice(0, 4);
  const date = typeof sp.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.datum) ? sp.datum : null;
  const guestsRaw = Number(typeof sp.gasten === "string" ? sp.gasten : "");
  const guests = Number.isFinite(guestsRaw) && guestsRaw > 0 ? Math.round(guestsRaw) : null;

  const supabase = await createClient();
  const { data } = ids.length
    ? await supabase
        .from("listings")
        .select("id, category, title, price_model, base_price_cents, min_guests, max_guests, attributes, vendors!inner(company_name, city)")
        .in("id", ids)
        .eq("is_published", true)
    : { data: [] };
  const listings = (data ?? []).map((l) => ({
    ...l,
    vendor: l.vendors as unknown as { company_name: string; city: string | null },
    attrs: (l.attributes ?? {}) as Record<string, unknown>,
  }));

  const status = new Map<string, string>();
  if (date && listings.length) {
    const { data: av } = await supabase.from("availability").select("listing_id, status").eq("date", date).in("listing_id", listings.map((l) => l.id));
    (av ?? []).forEach((a) => status.set(a.listing_id, a.status));
  }

  const estimates = listings.map((l) => estimateTotal(l.price_model, l.base_price_cents, guests));
  const cheapest = Math.min(...estimates.filter((e): e is number => e != null));

  // Eén rij per specificatie (op label) over alle gekozen categorieën heen.
  const specs = new Map<string, FieldDef>();
  listings.forEach((l) => FIELDS[l.category as CategoryDb].forEach((f) => specs.set(f.label, f)));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16">
        <h1 className="pt-6 font-display text-3xl font-bold">Vergelijken</h1>
        {(date || guests) && (
          <p className="mt-1 text-ink/60">
            {date && formatDate(date)} {guests && `· ${guests} gasten`}
          </p>
        )}

        {listings.length < 2 ? (
          <p className="mt-6 rounded-3xl bg-white p-8 text-ink/60">
            Selecteer minimaal 2 resultaten om te vergelijken. <Link href="/zoeken" className="font-semibold text-brand">Terug naar zoeken</Link>
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-3xl bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10">
                  <th className="w-44 p-4" />
                  {listings.map((l) => (
                    <th key={l.id} className="p-4 align-top">
                      <p className="text-xs font-semibold text-brand">{CATEGORIES.find((c) => c.db === l.category)?.label}</p>
                      <Link href={`/aanbod/${l.id}`} className="font-display text-lg font-bold hover:text-brand">{l.title}</Link>
                      <p className="font-normal text-ink/60">{l.vendor.company_name}{l.vendor.city ? ` · ${l.vendor.city}` : ""}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&_td]:p-4 [&_th]:p-4 [&_tr]:border-b [&_tr]:border-ink/5">
                <tr>
                  <th className="font-semibold">Prijs</th>
                  {listings.map((l) => (
                    <td key={l.id} className="font-semibold">{eur(l.base_price_cents)}<span className="font-normal text-ink/50">{PRICE_SUFFIX[l.price_model]}</span></td>
                  ))}
                </tr>
                {guests && (
                  <tr>
                    <th className="font-semibold">Geschat totaal</th>
                    {listings.map((l, i) => (
                      <td key={l.id}>
                        {estimates[i] != null ? eur(estimates[i]) : "Op aanvraag"}
                        {estimates[i] === cheapest && <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-bold">Voordeligst</span>}
                      </td>
                    ))}
                  </tr>
                )}
                <tr>
                  <th className="font-semibold">Gasten</th>
                  {listings.map((l) => (
                    <td key={l.id}>{l.min_guests != null || l.max_guests != null ? `${l.min_guests ?? 0} tot ${l.max_guests ?? "onbeperkt"}` : "-"}</td>
                  ))}
                </tr>
                {date && (
                  <tr>
                    <th className="font-semibold">Beschikbaar</th>
                    {listings.map((l) => {
                      const s = status.get(l.id);
                      return (
                        <td key={l.id}>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${s === "booked" ? "bg-st-lost" : s === "option" ? "bg-st-option" : "bg-st-won"}`}>
                            {s === "booked" ? "Bezet" : s === "option" ? "Optie" : "Vrij"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                )}
                {[...specs.values()].map((f) => (
                  <tr key={f.label}>
                    <th className="font-medium text-ink/70">{f.label}</th>
                    {listings.map((l) => {
                      const has = FIELDS[l.category as CategoryDb].some((x) => x.label === f.label);
                      const v = l.attrs[FIELDS[l.category as CategoryDb].find((x) => x.label === f.label)?.key ?? ""];
                      return (
                        <td key={l.id}>
                          {!has || v == null || v === false ? <Minus className="size-4 text-ink/25" /> : v === true ? <Check className="size-4 text-st-won" /> : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <th />
                  {listings.map((l) => (
                    <td key={l.id}>
                      <Link href={`/account/offerte/nieuw?id=${l.id}${date ? `&datum=${date}` : ""}${guests ? `&gasten=${guests}` : ""}`} className="inline-flex h-10 items-center rounded-full bg-coral px-5 font-semibold text-white hover:brightness-110">
                        Offerte aanvragen
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
