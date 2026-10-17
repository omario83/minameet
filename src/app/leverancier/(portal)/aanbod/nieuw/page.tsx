import Link from "next/link";
import { ListingForm } from "@/components/vendor/listing-form";
import { CATEGORIES } from "@/lib/categories";
import { isCategory } from "@/lib/listing-fields";
import { createListing } from "@/lib/vendor-actions";

export default async function NewListingPage({ searchParams }: PageProps<"/leverancier/aanbod/nieuw">) {
  const { categorie } = await searchParams;
  const category = isCategory(categorie) ? categorie : null;
  const selected = CATEGORIES.find((c) => c.db === category);

  return (
    <>
      <h1 className="mb-6 font-display text-3xl font-bold">
        {selected ? `Nieuw: ${selected.label}` : "Wat wil je aanbieden?"}
      </h1>

      {selected && category ? (
        <div className="max-w-3xl">
          <ListingForm action={createListing} category={category} submitLabel="Aanbod opslaan" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {CATEGORIES.map(({ db, label, blurb, gradient, icon: Icon }) => (
            <Link
              key={db}
              href={`/leverancier/aanbod/nieuw?categorie=${db}`}
              className={`relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-5 text-white transition hover:-translate-y-1 hover:shadow-xl`}
            >
              <Icon aria-hidden className="absolute -right-4 -top-4 size-28 rotate-12 opacity-20" />
              <span className="font-display text-xl font-bold">{label}</span>
              <span className="text-sm text-white/80">{blurb}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
