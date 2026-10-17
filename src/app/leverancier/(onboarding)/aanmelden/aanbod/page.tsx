import Link from "next/link";
import { redirect } from "next/navigation";
import { AvailabilityCalendar } from "@/components/vendor/availability-calendar";
import { ListingForm } from "@/components/vendor/listing-form";
import { PhotoManager } from "@/components/vendor/photo-manager";
import { StatusBanner } from "@/components/vendor/status-banner";
import { CATEGORIES } from "@/lib/categories";
import { isCategory, type CategoryDb } from "@/lib/listing-fields";
import { getOnboarding } from "@/lib/onboarding";
import { STEP_PATH, isComplete } from "@/lib/onboarding-steps";
import { MAX_PHOTOS, MIN_PHOTOS, photoUrl } from "@/lib/photos";
import { createListing, updateListing } from "@/lib/vendor-actions";

export default async function OnboardingListingPage({ searchParams }: PageProps<"/leverancier/aanmelden/aanbod">) {
  const { supabase, vendor, details, listings, state } = await getOnboarding();
  if (!details) redirect(STEP_PATH.bedrijfsgegevens);

  const { categorie, aanbod } = await searchParams;
  // Meer dan één aanbod kan voorkomen bij partners van vóór dit proces: toon het gevraagde, anders het eerste dat nog foto's mist.
  const photosOf = (l: (typeof listings)[number]) => (l.photos as string[]).length;
  const listing =
    listings.find((l) => l.id === (typeof aanbod === "string" ? aanbod : undefined)) ??
    listings.find((l) => photosOf(l) < MIN_PHOTOS) ??
    listings[0];
  // Partners van vóór de categoriekeuze bij het aanmelden kiezen hier alsnog.
  const category: CategoryDb | null = isCategory(vendor.primary_category)
    ? vendor.primary_category
    : isCategory(categorie)
      ? categorie
      : null;

  const availability = listing
    ? ((await supabase.from("availability").select("date, status").eq("listing_id", listing.id)).data ?? [])
    : [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <h1 className="font-display text-3xl font-bold">{listings.length > 1 ? "Je aanbod" : "Je eerste aanbod"}</h1>
      <p className="mb-6 mt-1 text-ink/60">
        Beschrijf wat je aanbiedt, met prijs en capaciteit. Daarna voeg je foto&apos;s en beschikbaarheid toe. Je aanbod wordt pas zichtbaar voor klanten nadat je bent goedgekeurd.
      </p>
      <StatusBanner vendor={vendor} />

      {listing && listings.length > 1 && (
        <nav aria-label="Jouw aanbod" className="mt-6 flex flex-wrap gap-2">
          {listings.map((l) => (
            <Link
              key={l.id}
              href={`/leverancier/aanmelden/aanbod?aanbod=${l.id}`}
              aria-current={l.id === listing.id ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${l.id === listing.id ? "bg-brand text-white" : "bg-white hover:text-brand"}`}
            >
              {l.title} · {photosOf(l)}/{MIN_PHOTOS} foto&apos;s
            </Link>
          ))}
        </nav>
      )}

      {listing ? (
        <div key={listing.id} className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-6">
            <ListingForm
              action={updateListing}
              category={listing.category as CategoryDb}
              hidePublish
              defaults={{ ...listing, attributes: listing.attributes as Record<string, unknown> }}
              submitLabel="Wijzigingen opslaan"
            />
            <PhotoManager
              listingId={listing.id}
              photos={(listing.photos as string[]).map((path) => ({ path, url: photoUrl(path) }))}
              max={MAX_PHOTOS}
              min={MIN_PHOTOS}
            />
          </div>
          <div>
            <h2 className="mb-1 font-display text-xl font-bold">Beschikbaarheid</h2>
            <p className="mb-3 text-sm text-ink/60">Markeer dagen die niet beschikbaar zijn. Je kunt dit later altijd aanpassen.</p>
            <AvailabilityCalendar
              listingId={listing.id}
              initial={availability as { date: string; status: "free" | "option" | "booked" }[]}
              locked={[]}
              today={today}
            />
          </div>
        </div>
      ) : category ? (
        <div className="mt-6 max-w-3xl">
          <ListingForm action={createListing} category={category} flow="onboarding" hidePublish submitLabel="Opslaan en foto's toevoegen" />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {CATEGORIES.map(({ db, label }) => (
            <Link key={db} href={`/leverancier/aanmelden/aanbod?categorie=${db}`} className="rounded-2xl bg-white p-5 font-semibold shadow-sm hover:text-brand">
              {label}
            </Link>
          ))}
        </div>
      )}

      {listing && (
        <div className="mt-8">
          {isComplete(state) ? (
            <Link href={STEP_PATH.insturen} className="inline-flex h-12 items-center rounded-full bg-brand px-8 font-semibold text-white hover:brightness-110">
              Verder naar insturen
            </Link>
          ) : (
            <p className="text-sm font-medium text-st-todo">Voeg minimaal {MIN_PHOTOS} foto&apos;s toe om verder te kunnen.</p>
          )}
        </div>
      )}
    </>
  );
}
