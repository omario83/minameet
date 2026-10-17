import "server-only";
import { sendEmail, siteUrl } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

/** Verstuurt wachtende herinneringen (melding + e-mail) en laat verlopen offertes vervallen. */
export async function processDueReminders() {
  const db = createAdminClient();
  if (!db) return { sent: 0, expired: 0, skipped: "SUPABASE_SERVICE_ROLE_KEY ontbreekt" };

  const site = siteUrl();

  const { data: due } = await db
    .from("reminders")
    .select("id, quote_id, quotes(status, total_cents, quote_requests(customer_id)), vendors(company_name)")
    .is("sent_at", null)
    .lte("send_at", new Date().toISOString())
    .limit(50);

  let sent = 0;
  for (const r of due ?? []) {
    const quote = r.quotes as unknown as { status: string; quote_requests: { customer_id: string } } | null;
    const vendor = r.vendors as unknown as { company_name: string } | null;

    if (quote?.status === "sent" && vendor) {
      const customerId = quote.quote_requests.customer_id;
      await db.from("notifications").insert({
        user_id: customerId,
        title: "Herinnering: je hebt een openstaande offerte",
        body: vendor.company_name,
        link: "/account",
      });

      const { data: user } = await db.auth.admin.getUserById(customerId);
      if (user.user?.email) {
        await sendEmail(
          user.user.email,
          `Herinnering van ${vendor.company_name}`,
          `${vendor.company_name} wacht op je reactie op de offerte. Bekijk de offerte in je MinaMeet-account: ${site}/account`,
        );
      }
      sent++;
    }
    await db.from("reminders").update({ sent_at: new Date().toISOString() }).eq("id", r.id);
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: expiredRows } = await db
    .from("quotes")
    .update({ status: "expired" })
    .eq("status", "sent")
    .lt("valid_until", today)
    .select("id");
  const expiredIds = (expiredRows ?? []).map((q) => q.id);
  if (expiredIds.length) {
    await db.from("tasks").update({ done_at: new Date().toISOString() }).in("quote_id", expiredIds).is("done_at", null);
  }

  return { sent, expired: expiredIds.length };
}
