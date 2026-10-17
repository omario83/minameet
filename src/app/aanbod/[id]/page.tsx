import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CATEGORIES } from "@/lib/categories";
import { PRICE_SUFFIX, eur, formatDate } from "@/lib/format";
import { FIELDS, PRICE_MODELS, type CategoryDb } from "@/lib/listing-fields";
import { photoUrl } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";

export default function ListingDetailPage({ params }: PageProps<"/aanbod/[id]">) {
  return (
    <Suspense fallback={<p className="p-10 text-ink/60">Laden…</p>}>
      <ListingDetail params={params} />
    </Suspense>
  );
}

async function ListingDetail({ params }: { params: PageProps<"/aanbod/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: l } = await supabase
    .from("listings")
    .select("id, category, title, description, price_model, base_price_cents, min_guests, max_guests, attributes, photos, vendors!inner(company_name, city, region, description, cultural_tags)")
    .eq("id", id)
    .eq("is_published", true)
    .single();
  if (!l) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const { data: busy } = await supabase
    .from("availability")
    .select("date, status")
    .eq("listing_id", id)
    .gte("date", today)
    .neq("status", "free")
    .order("date")
    .limit(40);

  const vendor = l.vendors as unknown as { company_name: string; city: string | null; region: string | null; description: string | null; cultural_tags: string[] };
  const category = CATEGORIES.find((c) => c.db === l.category);
  const attrs = (l.attributes ?? {}) as Record<string, unknown>;
  const photos = (l.photos ?? []) as string[];
  const fields = FIELDS[l.category as CategoryDb];
  const model = PRICE_MODELS.find((m) => m.value === l.price_model)?.label;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-16">
        <div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${category?.gradient} p-8 pt-32 text-white sm:pt-48`}>
          {photos[0] && (
            <>
              <Image src={photoUrl(photos[0])} alt="" fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />
            </>
          )}
          <div className="relative">
            <p className="text-sm font-semibold text-white/80">{category?.label}</p>
            <h1 className="font-display text-4xl font-bold">{l.title}</h1>
            <p className="mt-1 text-white/80">
              {vendor.company_name}
              {vendor.city ? ` · ${vendor.city}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            {l.description && <p className="whitespace-pre-line rounded-3xl bg-white p-6 text-ink/80">{l.description}</p>}

            {photos.length > 1 && (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.slice(1).map((p, i) => (
                  <li key={p} className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand">
                    <Image src={photoUrl(p)} alt={`${l.title}, foto ${i + 2}`} fill sizes="(min-width: 1024px) 220px, 50vw" className="object-cover" />
                  </li>
                ))}
              </ul>
            )}

            <section className="rounded-3xl bg-white p-6">
              <h2 className="mb-4 font-display text-xl font-bold">Specificaties</h2>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {l.min_guests != null || l.max_guests != null ? (
                  <Row label="Gasten" value={`${l.min_guests ?? 0} tot ${l.max_guests ?? "onbeperkt"}`} />
                ) : null}
                {fields.map((f) =>
                  attrs[f.key] == null ? null : (
                    <Row
                      key={f.key}
                      label={f.label}
                      value={f.type === "boolean" ? "Ja" : f.type === "select" ? (f.options?.find((o) => o.value === attrs[f.key])?.label ?? String(attrs[f.key])) : String(attrs[f.key])}
                    />
                  ),
                )}
              </dl>
            </section>

            {vendor.description && (
              <section className="rounded-3xl bg-white p-6">
                <h2 className="mb-2 font-display text-xl font-bold">Over {vendor.company_name}</h2>
                <p className="whitespace-pre-line text-ink/80">{vendor.description}</p>
                {vendor.cultural_tags.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-2">
                    {vendor.cultural_tags.map((t) => (
                      <span key={t} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">{t}</span>
                    ))}
                  </p>
                )}
              </section>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-6">
              <p className="font-display text-3xl font-extrabold text-brand">
                {eur(l.base_price_cents)}
                <span className="text-sm font-medium text-ink/50">{PRICE_SUFFIX[l.price_model]}</span>
              </p>
              <p className="text-sm text-ink/50">{model}</p>
              <Link
                href={`/account/offerte/nieuw?id=${l.id}`}
                className="mt-5 flex h-12 items-center justify-center rounded-full bg-coral font-semibold text-white hover:brightness-110"
              >
                Offerte aanvragen
              </Link>
            </div>

            <div className="rounded-3xl bg-white p-6">
              <h2 className="mb-3 font-display text-lg font-bold">Niet beschikbaar</h2>
              {busy?.length ? (
                <ul className="space-y-1.5 text-sm">
                  {busy.map((b) => (
                    <li key={b.date} className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${b.status === "booked" ? "bg-st-lost" : "bg-st-option"}`} />
                      {formatDate(b.date)} <span className="text-ink/40">{b.status === "booked" ? "geboekt" : "optie"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink/60">Geen bezette dagen bekend.</p>
              )}
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-ink/40">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
