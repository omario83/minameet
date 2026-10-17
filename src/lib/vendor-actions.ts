"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/auth-actions";
import { mails, sendEmail } from "@/lib/email";
import { PARTNER_TERMS_VERSION } from "@/lib/legal";
import { isCategory, parseAttributes, type CategoryDb } from "@/lib/listing-fields";
import { MAX_PHOTO_MB, MAX_PHOTOS, PHOTO_BUCKET, sniffImage } from "@/lib/photos";
import { fieldErrors } from "@/lib/schemas/errors";
import { KVK_DUPLICATE_MESSAGE, isKvkDuplicate, vendorDetailsSchema } from "@/lib/schemas/vendor-details";
import { getVendor } from "@/lib/vendor";

const SAVE_FAILED = "Opslaan is niet gelukt. Probeer het opnieuw.";

/** Eigen databasefouten (raise exception) zijn voor de gebruiker bedoeld; andere fouten niet. */
function userMessage(error: { code?: string; message: string }, fallback: string) {
  return error.code === "P0001" ? error.message : fallback;
}

const profileSchema = z.object({
  company_name: z.string().trim().min(2, "Vul je bedrijfsnaam in").max(100),
  description: z.string().trim().max(2000),
  city: z.string().trim().max(80),
  region: z.string().trim().max(80),
  cultural_tags: z.string().trim().max(300),
});

export async function updateVendorProfile(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, vendor } = await getVendor();
  const { cultural_tags, description, city, region, company_name } = parsed.data;
  const tags = cultural_tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);

  const { error } = await supabase
    .from("vendors")
    .update({ company_name, description: description || null, city: city || null, region: region || null, cultural_tags: tags })
    .eq("id", vendor.id);
  if (error) return { error: "Opslaan is niet gelukt. Probeer het opnieuw." };
  return { message: "Profiel opgeslagen." };
}

const listingSchema = z.object({
  title: z.string().trim().min(2, "Vul een titel in").max(120),
  description: z.string().trim().max(3000),
  price_model: z.enum(["fixed", "per_person", "per_hour", "from"]),
  price: z.string().trim(),
  min_guests: z.string().trim(),
  max_guests: z.string().trim(),
});

/** null = leeg, undefined = ongeldig. */
function nonNegative(raw: string, factor = 1): number | null | undefined {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * factor);
}

function buildListing(category: CategoryDb, formData: FormData) {
  const parsed = listingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const price = nonNegative(parsed.data.price, 100);
  const minGuests = nonNegative(parsed.data.min_guests);
  const maxGuests = nonNegative(parsed.data.max_guests);
  if (price === undefined) return { error: "Vul een geldige prijs in" };
  if (minGuests === undefined || maxGuests === undefined) return { error: "Vul een geldig aantal gasten in" };
  if (minGuests !== null && maxGuests !== null && minGuests > maxGuests) {
    return { error: "Minimum aantal gasten mag niet hoger zijn dan het maximum" };
  }

  const attributes = parseAttributes(category, formData);
  if ("error" in attributes) return { error: attributes.error };

  return {
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      price_model: parsed.data.price_model,
      base_price_cents: price,
      min_guests: minGuests,
      max_guests: maxGuests,
      attributes: attributes.values,
      is_published: formData.get("is_published") === "on",
    },
  };
}

export async function createListing(_: FormState, formData: FormData): Promise<FormState> {
  const category = formData.get("category");
  if (!isCategory(category)) return { error: "Kies eerst een categorie" };

  const built = buildListing(category, formData);
  if ("error" in built) return { error: built.error };

  const { supabase, vendor } = await getVendor();
  const { data, error } = await supabase
    .from("listings")
    .insert({ ...built.data, category, vendor_id: vendor.id })
    .select("id")
    .single();
  if (error || !data) return { error: error ? userMessage(error, SAVE_FAILED) : SAVE_FAILED };

  redirect(formData.get("flow") === "onboarding" ? "/leverancier/aanmelden/aanbod" : `/leverancier/aanbod/${data.id}`);
}

export async function updateListing(_: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Ongeldig aanbod" };

  const { supabase, vendor } = await getVendor();

  // De categorie komt uit de database, niet uit het formulier.
  const { data: existing } = await supabase
    .from("listings")
    .select("category")
    .eq("id", id.data)
    .eq("vendor_id", vendor.id)
    .single();
  if (!existing) return { error: "Aanbod niet gevonden" };

  const built = buildListing(existing.category as CategoryDb, formData);
  if ("error" in built) return { error: built.error };

  const { error } = await supabase.from("listings").update(built.data).eq("id", id.data).eq("vendor_id", vendor.id);
  if (error) return { error: userMessage(error, SAVE_FAILED) };
  return { message: "Opgeslagen." };
}

const availabilitySchema = z.object({
  listingId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["free", "option", "booked"]),
});

export async function setAvailability(
  listingId: string,
  date: string,
  status: "free" | "option" | "booked",
): Promise<{ error?: string }> {
  const parsed = availabilitySchema.safeParse({ listingId, date, status });
  if (!parsed.success) return { error: "Ongeldige invoer" };

  const { supabase, vendor } = await getVendor();

  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("id", parsed.data.listingId)
    .eq("vendor_id", vendor.id)
    .single();
  if (!listing) return { error: "Aanbod niet gevonden" };

  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("listing_id", listing.id)
    .eq("date", parsed.data.date)
    .maybeSingle();
  if (booking) return { error: "Deze dag is geboekt via MinaMeet en kan niet worden gewijzigd" };

  const result =
    parsed.data.status === "free"
      ? await supabase.from("availability").delete().eq("listing_id", listing.id).eq("date", parsed.data.date)
      : await supabase
          .from("availability")
          .upsert(
            { listing_id: listing.id, date: parsed.data.date, status: parsed.data.status },
            { onConflict: "listing_id,date" },
          );
  return result.error ? { error: "Opslaan is niet gelukt" } : {};
}

const MAX_BYTES = MAX_PHOTO_MB * 1024 * 1024;

export async function uploadListingPhoto(_: FormState, formData: FormData): Promise<FormState> {
  const listingId = z.uuid().safeParse(formData.get("listing_id"));
  const file = formData.get("photo");
  if (!listingId.success) return { error: "Ongeldig aanbod" };
  if (!(file instanceof File) || file.size === 0) return { error: "Kies eerst een foto" };
  if (file.size > MAX_BYTES) return { error: `De foto is groter dan ${MAX_PHOTO_MB} MB` };

  const { supabase, vendor } = await getVendor();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, photos")
    .eq("id", listingId.data)
    .eq("vendor_id", vendor.id)
    .single();
  if (!listing) return { error: "Aanbod niet gevonden" };
  if ((listing.photos as string[]).length >= MAX_PHOTOS) return { error: `Maximaal ${MAX_PHOTOS} foto's per aanbod` };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return { error: "Alleen JPG, PNG of WebP is toegestaan" };

  const path = `${vendor.id}/${listing.id}/${randomUUID()}.${type.ext}`;
  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: type.mime });
  if (uploadError) return { error: "Uploaden is niet gelukt. Probeer het opnieuw." };

  const { error } = await supabase
    .from("listings")
    .update({ photos: [...(listing.photos as string[]), path] })
    .eq("id", listing.id);
  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return { error: userMessage(error, "Opslaan is niet gelukt") };
  }

  revalidatePath(`/leverancier/aanbod/${listing.id}`);
  revalidatePath("/leverancier/aanmelden/aanbod");
  revalidatePath("/leverancier/start/fotos");
  return { message: "Foto toegevoegd." };
}

export async function removeListingPhoto(formData: FormData) {
  const listingId = z.uuid().safeParse(formData.get("listing_id"));
  const path = formData.get("path");
  if (!listingId.success || typeof path !== "string") return;

  const { supabase, vendor } = await getVendor();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, photos")
    .eq("id", listingId.data)
    .eq("vendor_id", vendor.id)
    .single();
  const photos = (listing?.photos ?? []) as string[];
  if (!listing || !photos.includes(path)) return;

  await supabase.from("listings").update({ photos: photos.filter((p) => p !== path) }).eq("id", listing.id);
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  revalidatePath(`/leverancier/aanbod/${listing.id}`);
  revalidatePath("/leverancier/aanmelden/aanbod");
  revalidatePath("/leverancier/start/fotos");
}

export async function deleteListing(_: FormState, formData: FormData): Promise<FormState> {
  const listingId = z.uuid().safeParse(formData.get("listing_id"));
  if (!listingId.success) return { error: "Ongeldig aanbod" };

  const { supabase, vendor } = await getVendor();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, photos")
    .eq("id", listingId.data)
    .eq("vendor_id", vendor.id)
    .single();
  if (!listing) return { error: "Aanbod niet gevonden" };

  const { error } = await supabase.from("listings").delete().eq("id", listing.id);
  if (error) {
    return {
      error:
        error.code === "P0001"
          ? error.message
          : "Dit aanbod heeft boekingen en kan niet worden verwijderd. Zet het op niet zichtbaar.",
    };
  }

  const photos = listing.photos as string[];
  if (photos.length) await supabase.storage.from(PHOTO_BUCKET).remove(photos);
  redirect("/leverancier/aanbod");
}

export async function saveBusinessDetails(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = vendorDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Controleer de gemarkeerde velden.", fieldErrors: fieldErrors(parsed.error) };

  const { supabase, vendor } = await getVendor();
  if (vendor.status === "pending" || vendor.status === "suspended") {
    return { error: "Bedrijfsgegevens kunnen niet worden gewijzigd tijdens de beoordeling of zolang je account geblokkeerd is. Neem contact op met MinaMeet." };
  }

  const { error } = await supabase
    .from("vendor_details")
    .upsert({ vendor_id: vendor.id, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "vendor_id" });
  if (error) {
    if (isKvkDuplicate(error)) {
      return { error: "Controleer de gemarkeerde velden.", fieldErrors: { kvk: KVK_DUPLICATE_MESSAGE } };
    }
    return { error: userMessage(error, SAVE_FAILED) };
  }

  if (formData.get("continue") === "1") redirect("/leverancier/aanmelden/aanbod");
  if (formData.get("continue") === "setup") redirect("/leverancier/start/fotos");
  revalidatePath("/leverancier/profiel");
  return { message: "Bedrijfsgegevens opgeslagen." };
}

export async function submitForReview(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, vendor } = await getVendor();

  // Partners zonder vastgelegd akkoord (aangemeld vóór het vinkje bestond) geven het hier alsnog.
  if (!vendor.terms_accepted_at) {
    if (formData.get("terms") !== "on") return { error: "Ga akkoord met de partnervoorwaarden en het privacybeleid." };
    const accepted = await supabase.rpc("accept_partner_terms", { p_version: PARTNER_TERMS_VERSION });
    if (accepted.error) return { error: "Het akkoord kon niet worden vastgelegd. Probeer het opnieuw." };
  }

  // De database controleert alles opnieuw en is de enige weg naar status 'pending'.
  const { error } = await supabase.rpc("submit_vendor_for_review");
  if (error) {
    return { error: error.code === "P0001" ? error.message : "Insturen is niet gelukt. Probeer het opnieuw." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;

  const received = mails.applicationReceived(vendor.company_name);
  const notice = mails.newApplication(vendor.company_name, vendor.id);
  await Promise.all([
    user?.email ? sendEmail(user.email, received.subject, received.text) : false,
    adminEmail ? sendEmail(adminEmail, notice.subject, notice.text) : console.warn("[email] ADMIN_NOTIFY_EMAIL ontbreekt"),
  ]);

  redirect("/leverancier/dashboard");
}
