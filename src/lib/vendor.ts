import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingState } from "@/lib/onboarding-steps";
import { createClient } from "@/lib/supabase/server";

export type Vendor = {
  id: string;
  company_name: string;
  description: string | null;
  city: string | null;
  region: string | null;
  cultural_tags: string[];
  status: "draft" | "pending" | "approved" | "rejected" | "suspended";
  commission_pct: number;
  primary_category: string | null;
  rejection_reason: string | null;
  terms_accepted_at: string | null;
  setup_completed_at: string | null;
};

export async function getVendor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/leverancier/inloggen");

  const { data } = await supabase
    .from("vendors")
    .select("id, company_name, description, city, region, cultural_tags, status, commission_pct, primary_category, rejection_reason, terms_accepted_at, setup_completed_at")
    .eq("owner_id", user.id)
    .single();
  if (!data) redirect("/leverancier/inloggen");

  return { supabase, vendor: data as Vendor };
}

/** Wat er nog ontbreekt om in te sturen: bedrijfsgegevens, aanbod en foto's. */
export async function getGoLiveState(supabase: SupabaseClient, vendorId: string): Promise<OnboardingState> {
  const [{ data: details }, { data: listings }] = await Promise.all([
    supabase.from("vendor_details").select("vendor_id").eq("vendor_id", vendorId).maybeSingle(),
    supabase.from("listings").select("id, photos").eq("vendor_id", vendorId),
  ]);
  return {
    hasDetails: !!details,
    listings: (listings ?? []).map((l) => ({ id: l.id, photoCount: (l.photos as string[]).length })),
  };
}
