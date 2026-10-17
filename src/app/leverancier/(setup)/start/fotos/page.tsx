import Link from "next/link";
import { PhotoManager } from "@/components/vendor/photo-manager";
import { MAX_PHOTOS, MIN_PHOTOS, photoUrl } from "@/lib/photos";
import { getVendor } from "@/lib/vendor";

export default async function SetupPhotosPage({ searchParams }: PageProps<"/leverancier/start/fotos">) {
  const { aanbod } = await searchParams;
  const { supabase, vendor } = await getVendor();
  const { data } = await supabase.from("listings").select("id, title, photos").eq("vendor_id", vendor.id).order("created_at");
  const listings = data ?? [];
  const listing = listings.find((l) => l.id === aanbod) ?? listings[0];

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Foto&apos;s</h1>
      <p className="mb-6 mt-2 text-ink/70">Upload foto&apos;s per dienst. Voor je aanmelding heb je minimaal {MIN_PHOTOS} foto&apos;s per aanbod nodig; nu is het optioneel.</p>

      {listing ? (
        <div className="space-y-4">
          {listings.length > 1 && (
            <nav aria-label="Jouw aanbod" className="flex flex-wrap gap-2">
              {listings.map((l) => (
                <Link
                  key={l.id}
                  href={`/leverancier/start/fotos?aanbod=${l.id}`}
                  aria-current={l.id === listing.id ? "page" : undefined}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${l.id === listing.id ? "bg-brand text-white" : "bg-white hover:text-brand"}`}
                >
                  {l.title}
                </Link>
              ))}
            </nav>
          )}
          <PhotoManager
            key={listing.id}
            listingId={listing.id}
            photos={(listing.photos as string[]).map((path) => ({ path, url: photoUrl(path) }))}
            max={MAX_PHOTOS}
            min={MIN_PHOTOS}
          />
        </div>
      ) : (
        <p className="rounded-2xl bg-white p-5 text-sm text-ink/70">
          Je hebt nog geen diensten gekozen.{" "}
          <Link href="/leverancier/start/diensten" className="font-semibold text-brand underline">
            Kies een dienst
          </Link>{" "}
          om foto&apos;s toe te voegen.
        </p>
      )}

      <p className="mt-6">
        <Link href="/leverancier/start/klaar" className="inline-flex h-12 items-center rounded-full bg-brand px-8 font-semibold text-white hover:brightness-110">
          Verder
        </Link>
      </p>
    </>
  );
}
