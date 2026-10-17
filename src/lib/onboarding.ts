import { redirect } from "next/navigation";
import type { OnboardingState } from "@/lib/onboarding-steps";
import { getVendor } from "@/lib/vendor";

export type BusinessDetailsRow = {
  kvk: string;
  vat_number: string | null;
  street: string;
  house_number: number;
  house_number_addition: string | null;
  postal_code: string;
  city: string;
  phone: string;
  website: string | null;
  contact_email: string;
};

/** Gegevens voor de aanmeldpagina's. Partners die niet meer in de aanmelding zitten gaan naar het dashboard. */
export async function getOnboarding() {
  const { supabase, vendor } = await getVendor();
  if (vendor.status !== "draft" && vendor.status !== "rejected") redirect("/leverancier/dashboard");

  const [{ data: details }, { data: listings }, { data: userData }] = await Promise.all([
    supabase
      .from("vendor_details")
      .select("kvk, vat_number, street, house_number, house_number_addition, postal_code, city, phone, website, contact_email")
      .eq("vendor_id", vendor.id)
      .maybeSingle(),
    supabase
      .from("listings")
      .select("id, category, title, description, price_model, base_price_cents, min_guests, max_guests, attributes, photos")
      .eq("vendor_id", vendor.id)
      .order("created_at"),
    supabase.auth.getUser(),
  ]);

  const state: OnboardingState = {
    hasDetails: !!details,
    listings: (listings ?? []).map((l) => ({ id: l.id, photoCount: (l.photos as string[]).length })),
  };

  return {
    supabase,
    vendor,
    details: details as BusinessDetailsRow | null,
    listings: listings ?? [],
    email: userData.user?.email ?? "",
    state,
  };
}
