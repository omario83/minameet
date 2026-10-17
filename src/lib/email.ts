import "server-only";

export { mails, siteUrl } from "@/lib/mail-templates";

/** Verstuurt een tekstmail via Resend. Gooit nooit; geeft false als het niet gelukt is. */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) {
    console.warn(`[email] RESEND_API_KEY of RESEND_FROM ontbreekt; mail "${subject}" is niet verstuurd`);
    return false;
  }

  // RESEND_API_URL is alleen bedoeld voor tests met een nepserver.
  const endpoint = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to, subject: subject.replace(/[\r\n]+/g, " "), text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error(`[email] Resend gaf status ${res.status} voor "${subject}"`);
    return res.ok;
  } catch (error) {
    console.error(`[email] versturen van "${subject}" mislukt`, error);
    return false;
  }
}
