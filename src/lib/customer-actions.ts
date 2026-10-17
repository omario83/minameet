"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/auth-actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  event_type: z.string().trim().max(60),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Kies een datum"),
  guest_count: z.string().trim(),
  budget: z.string().trim(),
  contact_name: z.string().trim().min(2, "Vul je naam in").max(100),
  contact_phone: z.string().trim().max(30),
  message: z.string().trim().max(2000),
});

export async function createQuoteRequests(_: FormState, formData: FormData): Promise<FormState> {
  await requireRole("customer");

  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.event_date < new Date().toISOString().slice(0, 10)) return { error: "De datum ligt in het verleden" };

  const guests = d.guest_count ? Number(d.guest_count) : null;
  const budget = d.budget ? Math.round(Number(d.budget) * 100) : null;
  if (guests !== null && (!Number.isInteger(guests) || guests < 1 || guests > 5000)) return { error: "Vul een geldig aantal gasten in" };
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return { error: "Vul een geldig budget in" };

  const ids = z.array(z.uuid()).min(1).max(5).safeParse([...new Set(formData.getAll("listing_id"))]);
  if (!ids.success) return { error: "Kies 1 tot 5 aanbieders" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/inloggen");

  const { data: listings } = await supabase.from("listings").select("id, vendor_id").in("id", ids.data).eq("is_published", true);
  if (!listings || listings.length !== ids.data.length) return { error: "Een van de gekozen aanbieders is niet meer beschikbaar" };

  const { error } = await supabase.from("quote_requests").insert(
    listings.map((l) => ({
      customer_id: user.id,
      vendor_id: l.vendor_id,
      listing_id: l.id,
      event_type: d.event_type || null,
      event_date: d.event_date,
      guest_count: guests,
      budget_cents: budget,
      message: d.message || null,
      contact_name: d.contact_name,
      contact_phone: d.contact_phone || null,
    })),
  );
  if (error) return { error: "Versturen is niet gelukt. Probeer het opnieuw." };

  redirect("/account");
}

export async function respondToQuote(_: FormState, formData: FormData): Promise<FormState> {
  await requireRole("customer");

  const quoteId = z.uuid().safeParse(formData.get("quote_id"));
  const decision = z.enum(["accept", "decline"]).safeParse(formData.get("decision"));
  if (!quoteId.success || !decision.success) return { error: "Ongeldige aanvraag" };

  const supabase = await createClient();
  const { error } = await supabase.rpc(decision.data === "accept" ? "accept_quote" : "decline_quote", {
    p_quote_id: quoteId.data,
  });
  if (error) return { error: error.message };

  revalidatePath("/account");
  return { message: decision.data === "accept" ? "Offerte geaccepteerd. De datum is voor jou gereserveerd." : "Offerte afgewezen." };
}

export async function cancelRequest(formData: FormData) {
  await requireRole("customer");
  const id = z.uuid().safeParse(formData.get("request_id"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase.from("quote_requests").update({ status: "cancelled" }).eq("id", id.data);
  revalidatePath("/account");
}
