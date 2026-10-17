"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/auth-actions";
import { processDueReminders } from "@/lib/reminders";
import { getVendor } from "@/lib/vendor";

const quoteSchema = z.object({
  request_id: z.uuid(),
  quote_id: z.union([z.uuid(), z.literal("")]),
  intent: z.enum(["save", "send"]),
  valid_until: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]),
  note: z.string().trim().max(2000),
});

export async function saveQuote(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = quoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ongeldige invoer" };
  const { request_id, intent, valid_until, note } = parsed.data;

  const descriptions = formData.getAll("item_description").map((v) => String(v).trim());
  const quantities = formData.getAll("item_quantity").map(Number);
  const prices = formData.getAll("item_price").map(Number);
  if (descriptions.length > 50) return { error: "Maximaal 50 regels" };

  const items = descriptions
    .map((description, i) => ({ description, quantity: quantities[i], unit_price_cents: Math.round(prices[i] * 100) }))
    .filter((i) => i.description || i.unit_price_cents);
  if (items.some((i) => !i.description || !(i.quantity > 0) || !Number.isFinite(i.unit_price_cents) || i.unit_price_cents < 0)) {
    return { error: "Controleer de offerteregels: omschrijving, aantal en prijs zijn verplicht" };
  }
  if (intent === "send" && items.length === 0) return { error: "Voeg minimaal één regel toe" };

  const today = new Date().toISOString().slice(0, 10);
  if (intent === "send" && valid_until && valid_until < today) return { error: "De geldigheidsdatum ligt in het verleden" };

  const total = items.reduce((sum, i) => sum + Math.round(i.quantity * i.unit_price_cents), 0);

  const { supabase, vendor } = await getVendor();
  const { data: request } = await supabase
    .from("quote_requests")
    .select("id, status")
    .eq("id", request_id)
    .eq("vendor_id", vendor.id)
    .single();
  if (!request) return { error: "Aanvraag niet gevonden" };
  if (!["open", "quoted"].includes(request.status)) return { error: "Deze aanvraag is afgesloten" };

  let quoteId = parsed.data.quote_id;
  if (quoteId) {
    const { data: existing } = await supabase.from("quotes").select("status").eq("id", quoteId).eq("vendor_id", vendor.id).single();
    if (existing?.status !== "draft") return { error: "Deze offerte kan niet meer worden aangepast" };
    const { error } = await supabase
      .from("quotes")
      .update({ total_cents: total, valid_until: valid_until || null, note: note || null })
      .eq("id", quoteId);
    if (error) return { error: "Opslaan is niet gelukt" };
  } else {
    const { data, error } = await supabase
      .from("quotes")
      .insert({ request_id, vendor_id: vendor.id, total_cents: total, valid_until: valid_until || null, note: note || null })
      .select("id")
      .single();
    if (error || !data) return { error: "Opslaan is niet gelukt" };
    quoteId = data.id;
  }

  await supabase.from("quote_items").delete().eq("quote_id", quoteId);
  if (items.length) {
    const { error } = await supabase.from("quote_items").insert(items.map((i) => ({ ...i, quote_id: quoteId })));
    if (error) return { error: "Offerteregels opslaan is niet gelukt" };
  }

  if (intent === "send") {
    const { error } = await supabase.from("quotes").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", quoteId);
    if (error) return { error: "Versturen is niet gelukt" };
    redirect("/leverancier/dashboard");
  }

  revalidatePath(`/leverancier/aanvragen/${request_id}`);
  return { message: "Concept opgeslagen." };
}

export async function declineRequest(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("request_id"));
  if (!id.success) return;

  const { supabase, vendor } = await getVendor();
  const { error } = await supabase
    .from("quote_requests")
    .update({ status: "declined" })
    .eq("id", id.data)
    .eq("vendor_id", vendor.id)
    .eq("status", "open");
  if (error) return;

  await supabase.from("tasks").update({ done_at: new Date().toISOString() }).eq("request_id", id.data).is("done_at", null);
  redirect("/leverancier/dashboard");
}

export async function sendReminder(_: FormState, formData: FormData): Promise<FormState> {
  const quoteId = z.uuid().safeParse(formData.get("quote_id"));
  if (!quoteId.success) return { error: "Ongeldige offerte" };

  const { supabase, vendor } = await getVendor();
  const { data: quote } = await supabase.from("quotes").select("id, status").eq("id", quoteId.data).eq("vendor_id", vendor.id).single();
  if (quote?.status !== "sent") return { error: "Alleen voor verstuurde offertes" };

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("quote_id", quote.id)
    .gte("created_at", since);
  if (count) return { error: "Je hebt vandaag al een herinnering gestuurd" };

  const { error } = await supabase.from("reminders").insert({ quote_id: quote.id, vendor_id: vendor.id });
  if (error) return { error: "Herinnering versturen is niet gelukt" };

  await processDueReminders().catch(() => undefined);
  revalidatePath("/leverancier/dashboard");
  return { message: "Herinnering verstuurd." };
}
