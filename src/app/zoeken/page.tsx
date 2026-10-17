import { Suspense } from "react";
import { connection } from "next/server";
import { Sparkles } from "lucide-react";
import { ResultCard } from "@/components/result-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { parseQuery, EMPTY_QUERY } from "@/lib/ai/parse-query";
import { CATEGORIES } from "@/lib/categories";
import { formatDate } from "@/lib/format";
import { isCategory, type CategoryDb } from "@/lib/listing-fields";
import { searchListings, type Hit } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

type Params = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const num = (v: string | string[] | undefined) => {
  const n = Number(str(v));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const inputClass = "h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none focus:border-brand";

export default function SearchPage({ searchParams }: PageProps<"/zoeken">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16">
        <Suspense fallback={<p className="py-10 text-ink/60">Zoeken…</p>}>
          <Results searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  await connection();
  const today = new Date().toISOString().slice(0, 10);
  const q = str(sp.q).slice(0, 300);

  const parsed = q ? await parseQuery(q, today) : EMPTY_QUERY;

  // Expliciete filters winnen van wat de AI uit de tekst haalde.
  const slug = str(sp.categorie);
  const chosen = CATEGORIES.find((c) => c.slug === slug)?.db;
  const categories: CategoryDb[] = chosen ? [chosen] : parsed.categories.filter(isCategory);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(sp.datum)) ? str(sp.datum) : parsed.date;
  const guests = num(sp.gasten) ?? parsed.guests;
  const city = str(sp.plaats) || parsed.city;
  const budget = num(sp.budget) ?? parsed.budget_eur;

  const supabase = await createClient();
  const hits = await searchListings(supabase, {
    categories,
    date: date && date >= today ? date : null,
    guests,
    budgetEur: budget,
    city,
    culture: parsed.culture,
    halal: parsed.halal,
  });

  const understood = [
    parsed.event_type,
    parsed.culture && `${parsed.culture} stijl`,
    guests && `${guests} gasten`,
    date && formatDate(date),
    city,
    budget && `budget € ${budget}`,
    parsed.halal && "halal",
  ].filter(Boolean) as string[];

  const groups = categories.length === 1 || !categories.length
    ? [{ key: "all", label: null as string | null, hits }]
    : categories.map((c) => ({
        key: c,
        label: CATEGORIES.find((x) => x.db === c)?.label ?? c,
        hits: hits.filter((h) => h.category === c),
      }));

  return (
    <>
      <h1 className="pt-6 font-display text-3xl font-bold">Zoeken</h1>

      <form action="/zoeken" className="mt-4 space-y-3 rounded-3xl bg-white p-4 shadow-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Beschrijf je feest, bijvoorbeeld: Turkse bruiloft voor 250 gasten in Rotterdam"
          className="h-12 w-full rounded-xl border border-ink/15 px-4 outline-none focus:border-brand"
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <select name="categorie" defaultValue={chosen ? CATEGORIES.find((c) => c.db === chosen)?.slug : ""} className={inputClass}>
            <option value="">Alle diensten</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
          <input name="datum" type="date" min={today} defaultValue={date ?? ""} className={inputClass} aria-label="Datum" />
          <input name="gasten" type="number" min="1" placeholder="Aantal gasten" defaultValue={guests ?? ""} className={inputClass} />
          <input name="plaats" placeholder="Plaats" defaultValue={city ?? ""} className={inputClass} />
          <button className="h-11 rounded-xl bg-coral font-semibold text-white hover:brightness-110">Zoeken</button>
        </div>
      </form>

      {q && understood.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink/70">
          <Sparkles className="size-4 text-brand" /> Dit hebben we begrepen:
          {understood.map((u) => (
            <span key={u} className="rounded-full bg-brand-soft px-3 py-1 font-medium text-brand">{u}</span>
          ))}
        </p>
      )}

      <form action="/vergelijk" className="mt-6">
        {date && <input type="hidden" name="datum" value={date} />}
        {guests && <input type="hidden" name="gasten" value={guests} />}

        {hits.length === 0 ? (
          <p className="rounded-3xl bg-white p-8 text-ink/60">
            Geen resultaten. Pas je zoekopdracht of filters aan, of kies een andere datum.
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="mb-10">
              {g.label && <h2 className="mb-3 font-display text-2xl font-bold">{g.label}</h2>}
              {g.hits.length === 0 ? (
                <p className="text-ink/50">Geen beschikbare aanbieders in deze categorie.</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.hits.map((h: Hit) => (
                    <ResultCard key={h.id} hit={h} />
                  ))}
                </ul>
              )}
            </section>
          ))
        )}

        {hits.length > 0 && (
          <div className="sticky bottom-4 z-20 mx-auto flex max-w-xl items-center justify-center gap-3 rounded-full bg-ink p-2 text-sm font-semibold text-white shadow-xl">
            <button className="rounded-full bg-white px-5 py-2.5 text-ink">Vergelijk (2 tot 4)</button>
            <button formAction="/account/offerte/nieuw" className="rounded-full bg-coral px-5 py-2.5">
              Offerte aanvragen
            </button>
          </div>
        )}
      </form>
    </>
  );
}
