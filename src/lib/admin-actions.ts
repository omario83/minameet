"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import type { FormState } from "@/lib/auth-actions";
import { mails, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  vendor_id: z.uuid(),
  status: z.enum(["approved", "suspended"]).optional(),
  commission_pct: z.coerce.number().min(0).max(50),
});

/** Commissie wijzigen en een goedgekeurde partner blokkeren of deblokkeren. */
export async function updateVendorAdmin(formData: FormData) {
  await requireRole("admin");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: current } = await supabase.from("vendors").select("status").eq("id", parsed.data.vendor_id).single();
  if (!current) return;

  // Goedkeuren en afkeuren lopen via approve_vendor/reject_vendor; hier blijft de status anders ongemoeid.
  const togglable = current.status === "approved" || current.status === "suspended";
  const status = togglable ? (parsed.data.status ?? current.status) : current.status;

  await supabase.from("vendors").update({ status, commission_pct: parsed.data.commission_pct }).eq("id", parsed.data.vendor_id);
  revalidatePath("/admin");
}

async function mailOwner(vendorId: string, build: (company: string) => { subject: string; text: string }) {
  const db = createAdminClient();
  if (!db) {
    console.warn("[email] SUPABASE_SERVICE_ROLE_KEY ontbreekt; kan het e-mailadres van de partner niet opzoeken");
    return false;
  }

  const { data: vendor } = await db.from("vendors").select("owner_id, company_name").eq("id", vendorId).single();
  if (!vendor) return false;
  const { data } = await db.auth.admin.getUserById(vendor.owner_id);
  const email = data.user?.email;
  if (!email) return false;

  const mail = build(vendor.company_name);
  return sendEmail(email, mail.subject, mail.text);
}

function refresh(vendorId: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/partners/${vendorId}`);
}

export async function approveVendor(_: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const vendorId = z.uuid().safeParse(formData.get("vendor_id"));
  if (!vendorId.success) return { error: "Ongeldige partner" };

  // De database zet de status én publiceert alle aanbod in één transactie.
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_vendor", { p_vendor_id: vendorId.data });
  if (error) return { error: error.code === "P0001" ? error.message : "Goedkeuren is niet gelukt." };

  const mailed = await mailOwner(vendorId.data, mails.approved);
  refresh(vendorId.data);
  return {
    message: mailed
      ? "Partner goedgekeurd, het aanbod is gepubliceerd en de partner is per e-mail op de hoogte gebracht."
      : "Partner goedgekeurd en het aanbod is gepubliceerd, maar de e-mail kon niet worden verstuurd. Informeer de partner zelf.",
  };
}

export async function rejectVendor(_: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = z
    .object({
      vendor_id: z.uuid(),
      reason: z.string().trim().min(5, "Geef een reden op (minimaal 5 tekens)").max(1000, "De reden is te lang"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_vendor", { p_vendor_id: parsed.data.vendor_id, p_reason: parsed.data.reason });
  if (error) return { error: error.code === "P0001" ? error.message : "Afkeuren is niet gelukt." };

  const mailed = await mailOwner(parsed.data.vendor_id, (company) => mails.rejected(company, parsed.data.reason));
  refresh(parsed.data.vendor_id);
  return {
    message: mailed
      ? "Partner afgekeurd en per e-mail op de hoogte gebracht."
      : "Partner afgekeurd, maar de e-mail kon niet worden verstuurd. Informeer de partner zelf.",
  };
}
