// Haalt mails op uit de lokale Supabase-mailserver: Inbucket (poort 54324) of Mailpit, die dezelfde poort gebruikt.
const MAIL_URL = process.env.E2E_MAIL_URL ?? "http://127.0.0.1:54324";

export type Mail = { id: string; subject: string; html: string; text: string; date: number };

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${MAIL_URL}${path}`);
  return res.ok ? ((await res.json()) as T) : null;
}

async function fromInbucket(email: string): Promise<Mail[] | null> {
  const name = encodeURIComponent(email.split("@")[0]);
  const list = await getJson<{ id: string; subject: string; date: string }[]>(`/api/v1/mailbox/${name}`);
  if (!Array.isArray(list)) return null;

  const mails: Mail[] = [];
  for (const item of list) {
    const full = await getJson<{ body?: { html?: string; text?: string } }>(`/api/v1/mailbox/${name}/${item.id}`);
    mails.push({ id: item.id, subject: item.subject, html: full?.body?.html ?? "", text: full?.body?.text ?? "", date: Date.parse(item.date) });
  }
  return mails;
}

async function fromMailpit(email: string): Promise<Mail[]> {
  const found = await getJson<{ messages?: { ID: string; Subject: string; Created: string }[] }>(
    `/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  const mails: Mail[] = [];
  for (const item of found?.messages ?? []) {
    const full = await getJson<{ HTML?: string; Text?: string }>(`/api/v1/message/${item.ID}`);
    mails.push({ id: item.ID, subject: item.Subject, html: full?.HTML ?? "", text: full?.Text ?? "", date: Date.parse(item.Created) });
  }
  return mails;
}

/** Alle mails voor dit adres, oudste eerst. */
export async function mailsFor(email: string): Promise<Mail[]> {
  const mails = (await fromInbucket(email)) ?? (await fromMailpit(email));
  return mails.sort((a, b) => a.date - b.date);
}

/** Wacht tot er minimaal `count` mails zijn die bij `subject` passen en geeft de nieuwste terug. */
export async function waitForMail(email: string, { subject, count = 1, timeout = 15_000 }: { subject?: RegExp; count?: number; timeout?: number } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const matching = (await mailsFor(email)).filter((m) => !subject || subject.test(m.subject));
    if (matching.length >= count) return matching[matching.length - 1];
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Geen mail voor ${email}${subject ? ` met onderwerp ${subject}` : ""} binnen ${timeout} ms`);
}

/** De knop-link uit de mail (de verify-URL van Supabase Auth). */
export function linkFrom(mail: Mail) {
  const href = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(mail.html)?.[1] ?? /(https?:\/\/\S*\/auth\/v1\/verify\S*)/.exec(mail.text)?.[1];
  if (!href) throw new Error(`Geen verify-link gevonden in "${mail.subject}"`);
  return href.replaceAll("&amp;", "&");
}
