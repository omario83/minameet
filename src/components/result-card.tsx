import Link from "next/link";
import Image from "next/image";
import { CATEGORIES } from "@/lib/categories";
import { PRICE_SUFFIX, eur } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import type { Hit } from "@/lib/search";

export function ResultCard({ hit }: { hit: Hit }) {
  const category = CATEGORIES.find((c) => c.db === hit.category);
  const Icon = category?.icon;

  return (
    <li className="relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition hover:shadow-md">
      <div className={`relative flex h-40 items-end bg-gradient-to-br ${category?.gradient} p-4 text-white`}>
        {hit.photos[0] ? (
          <>
            <Image src={photoUrl(hit.photos[0])} alt="" fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
          </>
        ) : (
          Icon && <Icon aria-hidden className="absolute right-3 top-3 size-16 opacity-25" />
        )}
        <span className="relative rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">{category?.label}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-display text-lg font-bold leading-tight">
            <Link href={`/aanbod/${hit.id}`} className="after:absolute after:inset-0">
              {hit.title}
            </Link>
          </h3>
          <p className="text-sm text-ink/60">
            {hit.vendor.company_name}
            {hit.vendor.city ? ` · ${hit.vendor.city}` : ""}
          </p>
        </div>

        <p className="font-display text-xl font-extrabold text-brand">
          {eur(hit.base_price_cents)}
          <span className="text-sm font-medium text-ink/50">{PRICE_SUFFIX[hit.price_model]}</span>
        </p>
        {hit.estimateCents != null && hit.price_model === "per_person" && (
          <p className="-mt-2 text-xs text-ink/50">Geschat totaal {eur(hit.estimateCents)}</p>
        )}

        {hit.availability !== "unknown" && (
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-semibold text-white ${hit.availability === "free" ? "bg-st-won" : "bg-st-option"}`}
          >
            {hit.availability === "free" ? "Beschikbaar op jouw datum" : "Optie op jouw datum"}
          </span>
        )}

        {hit.reasons.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {hit.reasons.map((r) => (
              <li key={r} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                {r}
              </li>
            ))}
          </ul>
        )}

        <label className="relative z-10 mt-auto flex items-center gap-2 pt-2 text-sm font-medium">
          <input type="checkbox" name="id" value={hit.id} className="size-4 accent-brand" />
          Selecteer
        </label>
      </div>
    </li>
  );
}
