"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth-actions";
import { CATEGORIES } from "@/lib/categories";
import { parseServices } from "@/lib/schemas/setup";
import { getVendor } from "@/lib/vendor";

/** Maakt per gekozen dienst een (nog niet zichtbaar) aanbod aan, of past de prijs van een bestaand aanbod aan. */
export async function saveSetupServices(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseServices(formData.getAll("category"), Object.fromEntries(formData));
  if (!parsed.success) return { error: "Controleer de gemarkeerde velden.", fieldErrors: parsed.errors };

  const { supabase, vendor } = await getVendor();
  const { data: existing } = await supabase.from("listings").select("id, category").eq("vendor_id", vendor.id).order("created_at");

  for (const service of parsed.data) {
    const current = existing?.find((l) => l.category === service.category);
    const values = { price_model: service.price_model, base_price_cents: service.base_price_cents };
    const label = CATEGORIES.find((c) => c.db === service.category)?.label ?? "Aanbod";

    const { error } = current
      ? await supabase.from("listings").update(values).eq("id", current.id).eq("vendor_id", vendor.id)
      : await supabase.from("listings").insert({
          ...values,
          vendor_id: vendor.id,
          category: service.category,
          title: `${vendor.company_name} · ${label}`.slice(0, 120),
          is_published: false,
        });
    if (error) return { error: "Opslaan is niet gelukt. Probeer het opnieuw." };
  }

  revalidatePath("/leverancier/aanbod");
  redirect("/leverancier/start/kalender");
}

/** Sluit de instelassistent af (ook als alles is overgeslagen) en gaat naar het dashboard. */
export async function completeSetup() {
  const { supabase, vendor } = await getVendor();
  if (!vendor.setup_completed_at) {
    await supabase.from("vendors").update({ setup_completed_at: new Date().toISOString() }).eq("id", vendor.id);
  }
  redirect("/leverancier/dashboard");
}
