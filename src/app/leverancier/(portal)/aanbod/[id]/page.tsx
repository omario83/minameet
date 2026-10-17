import { notFound } from "next/navigation";
import { AvailabilityCalendar } from "@/components/vendor/availability-calendar";
import { ListingForm } from "@/components/vendor/listing-form";
import { CATEGORIES } from "@/lib/categories";
import type { CategoryDb } from "@/lib/listing-fields";
import { MAX_PHOTOS, photoUrl } from "@/lib/photos";
import { DeleteListing } from "@/components/vendor/delete-listing";
import { PhotoManager } from "@/components/vendor/photo-manager";
import { updateListing } from "@/lib/vendor-actions";
import { getVendor } from "@/lib/vendor";
import { z } from "zod";

export default async function EditListingPage({ params }: PageProps<"/leverancier/aanbod/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { supabase, vendor } = await getVendor();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, category, title, description, price_model, base_price_cents, min_guests, max_guests, attributes, is_published, photos")
    .eq("id", id)
    .eq("vendor_id", vendor.id)
    .single();
  if (!listing) notFound();

  const [{ data: availability }, { data: bookings }] = await Promise.all([
    supabase.from("availability").select("date, status").eq("listing_id", id),
    supabase.from("bookings").select("date").eq("listing_id", id),
  ]);

  const category = listing.category as CategoryDb;
  const label = CATEGORIES.find((c) => c.db === category)?.label;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <p className="text-sm font-semibold text-brand">{label}</p>
      <h1 className="mb-6 font-display text-3xl font-bold">{listing.title}</h1>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <ListingForm
            action={updateListing}
            category={category}
            defaults={{ ...listing, attributes: listing.attributes as Record<string, unknown> }}
            submitLabel="Wijzigingen opslaan"
          />
          <PhotoManager
            listingId={id}
            photos={(listing.photos as string[]).map((path) => ({ path, url: photoUrl(path) }))}
            max={MAX_PHOTOS}
          />
          <DeleteListing listingId={id} />
        </div>
        <div>
          <h2 className="mb-3 font-display text-xl font-bold">Beschikbaarheid</h2>
          <AvailabilityCalendar
            listingId={id}
            initial={(availability ?? []) as { date: string; status: "free" | "option" | "booked" }[]}
            locked={(bookings ?? []).map((b) => b.date).filter((d): d is string => !!d)}
            today={today}
          />
        </div>
      </div>
    </>
  );
}
