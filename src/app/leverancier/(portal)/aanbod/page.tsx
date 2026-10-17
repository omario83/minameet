import Link from "next/link";
import { Plus } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { StatusBanner } from "@/components/vendor/status-banner";
import { PRICE_MODELS } from "@/lib/listing-fields";
import { getVendor } from "@/lib/vendor";

export default async function ListingsPage() {
  const { supabase, vendor } = await getVendor();
  const { data: listings } = await supabase
    .from("listings")
    .select("id, category, title, price_model, base_price_cents, is_published")
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Mijn aanbod</h1>
        <Link
          href="/leverancier/aanbod/nieuw"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 font-semibold text-white hover:brightness-110"
        >
          <Plus className="size-4" /> Nieuw aanbod
        </Link>
      </div>

      <StatusBanner vendor={vendor} />

      {!listings?.length ? (
        <p className="rounded-3xl bg-white p-8 text-ink/60">Je hebt nog geen aanbod. Voeg je eerste zaal of dienst toe.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {listings.map((l) => {
            const category = CATEGORIES.find((c) => c.db === l.category);
            const model = PRICE_MODELS.find((m) => m.value === l.price_model)?.label;
            return (
              <li key={l.id}>
                <Link href={`/leverancier/aanbod/${l.id}`} className="block rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">{category?.label}</span>
                    <span className={l.is_published ? "text-st-won" : "text-st-expired"}>{l.is_published ? "Zichtbaar" : "Concept"}</span>
                  </div>
                  <h2 className="mt-3 font-display text-xl font-bold">{l.title}</h2>
                  <p className="mt-1 text-sm text-ink/60">
                    {l.base_price_cents != null
                      ? `€ ${(l.base_price_cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: 2 })} · ${model}`
                      : "Prijs op aanvraag"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
