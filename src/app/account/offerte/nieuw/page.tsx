import Link from "next/link";
import { z } from "zod";
import { QuoteRequestForm } from "@/components/customer/quote-request-form";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const toArray = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function NewQuoteRequestPage({ searchParams }: PageProps<"/account/offerte/nieuw">) {
  const sp = await searchParams;
  const ids = [...new Set(toArray(sp.id))].filter((i) => z.uuid().safeParse(i).success).slice(0, 5);

  const supabase = await createClient();
  const { data } = ids.length
    ? await supabase.from("listings").select("id, title, vendors!inner(company_name)").in("id", ids).eq("is_published", true)
    : { data: [] };
  const listings = (data ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    vendor: (l.vendors as unknown as { company_name: string }).company_name,
  }));

  const profile = await getProfile();
  const today = new Date().toISOString().slice(0, 10);
  const date = typeof sp.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.datum) ? sp.datum : undefined;
  const guests = typeof sp.gasten === "string" && /^\d{1,4}$/.test(sp.gasten) ? sp.gasten : undefined;

  if (!listings.length) {
    return (
      <p className="rounded-3xl bg-white p-8 text-ink/60">
        Je hebt nog geen aanbieders gekozen. <Link href="/zoeken" className="font-semibold text-brand">Ga naar zoeken</Link>
      </p>
    );
  }

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-bold">Offerte aanvragen</h1>
      <ul className="mb-6 flex flex-wrap gap-2">
        {listings.map((l) => (
          <li key={l.id} className="rounded-full bg-brand-soft px-4 py-1.5 text-sm font-medium text-brand">
            {l.title} · {l.vendor}
          </li>
        ))}
      </ul>
      <div className="max-w-3xl">
        <QuoteRequestForm listings={listings} defaults={{ date, guests, name: profile?.full_name ?? "" }} today={today} />
      </div>
    </>
  );
}
