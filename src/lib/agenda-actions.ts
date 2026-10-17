"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/auth-actions";
import { FeedError, syncFeed } from "@/lib/agenda/feed-sync";
import { normalizeFeedUrl } from "@/lib/agenda/feed-url";
import { parseAgendaItem, parseOpeningHours } from "@/lib/schemas/agenda";
import { getVendor } from "@/lib/vendor";

function refreshAgenda() {
  revalidatePath("/leverancier/agenda");
  revalidatePath("/leverancier/dashboard");
}

/** Maakt een afspraak of blokkade aan, of wijzigt die als het formulier een id meestuurt. */
export async function saveAgendaItem(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseAgendaItem(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Controleer de gemarkeerde velden.", fieldErrors: parsed.errors };

  const { supabase, vendor } = await getVendor();
  const { id, ...data } = parsed.data;

  const result = id
    ? await supabase.from("agenda_items").update(data).eq("id", id).eq("vendor_id", vendor.id).neq("kind", "external").select("id")
    : await supabase.from("agenda_items").insert({ ...data, vendor_id: vendor.id }).select("id");

  if (result.error) return { error: result.error.code === "P0001" ? result.error.message : "Opslaan is niet gelukt. Probeer het opnieuw." };
  if (id && !result.data?.length) return { error: "Deze afspraak bestaat niet meer of kan niet worden gewijzigd." };

  refreshAgenda();
  return { message: id ? "Wijzigingen opgeslagen." : "Toegevoegd aan je agenda." };
}

export async function deleteAgendaItem(_: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Ongeldige afspraak" };

  const { supabase, vendor } = await getVendor();
  const { error } = await supabase.from("agenda_items").delete().eq("id", id.data).eq("vendor_id", vendor.id).neq("kind", "external");
  if (error) return { error: "Verwijderen is niet gelukt. Probeer het opnieuw." };

  refreshAgenda();
  return { message: "Verwijderd." };
}

export async function saveOpeningHours(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseOpeningHours(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Controleer de gemarkeerde velden.", fieldErrors: parsed.errors };

  const { supabase, vendor } = await getVendor();
  const { error } = await supabase
    .from("vendor_opening_hours")
    .upsert(parsed.data.map((day) => ({ vendor_id: vendor.id, ...day })), { onConflict: "vendor_id,weekday" });
  if (error) return { error: "Opslaan is niet gelukt. Probeer het opnieuw." };

  refreshAgenda();
  revalidatePath("/leverancier/profiel");
  if (formData.get("continue") === "setup") redirect("/leverancier/start/bedrijf");
  return { message: "Openingstijden opgeslagen." };
}

/** Koppelt een externe kalender (iCal-adres) en importeert de afspraken als bezette momenten. */
export async function connectCalendarFeed(_: FormState, formData: FormData): Promise<FormState> {
  const checked = normalizeFeedUrl(String(formData.get("url") ?? ""));
  if (!checked.ok) return { error: checked.error, fieldErrors: { url: checked.error } };

  const { supabase, vendor } = await getVendor();
  const { data: previous } = await supabase.from("calendar_feeds").select("id").eq("vendor_id", vendor.id).maybeSingle();

  const { data: feed, error } = await supabase
    .from("calendar_feeds")
    .upsert({ vendor_id: vendor.id, url: checked.url, last_error: null }, { onConflict: "vendor_id" })
    .select("id, url")
    .single();
  if (error || !feed) return { error: "Koppelen is niet gelukt. Probeer het opnieuw." };

  try {
    const count = await syncFeed(supabase, vendor.id, feed);
    refreshAgenda();
    revalidatePath("/leverancier/profiel");
    return { message: `Gekoppeld. ${count} ${count === 1 ? "afspraak" : "afspraken"} geïmporteerd.` };
  } catch (e) {
    // Een nieuwe koppeling die niet werkt, laten we niet achter.
    if (!previous) await supabase.from("calendar_feeds").delete().eq("id", feed.id);
    return { error: e instanceof FeedError ? e.message : "Koppelen is niet gelukt.", fieldErrors: { url: e instanceof FeedError ? e.message : "Koppelen is niet gelukt." } };
  }
}

export async function syncCalendarFeed(): Promise<FormState> {
  const { supabase, vendor } = await getVendor();
  const { data: feed } = await supabase.from("calendar_feeds").select("id, url").eq("vendor_id", vendor.id).maybeSingle();
  if (!feed) return { error: "Er is geen kalender gekoppeld." };

  try {
    const count = await syncFeed(supabase, vendor.id, feed);
    refreshAgenda();
    return { message: `Bijgewerkt. ${count} ${count === 1 ? "afspraak" : "afspraken"} uit je kalender.` };
  } catch (e) {
    refreshAgenda();
    return { error: e instanceof FeedError ? e.message : "Synchroniseren is niet gelukt." };
  }
}

export async function disconnectCalendarFeed(): Promise<FormState> {
  const { supabase, vendor } = await getVendor();
  const { error } = await supabase.from("calendar_feeds").delete().eq("vendor_id", vendor.id);
  if (error) return { error: "Loskoppelen is niet gelukt. Probeer het opnieuw." };

  refreshAgenda();
  revalidatePath("/leverancier/profiel");
  return { message: "Kalender losgekoppeld." };
}
