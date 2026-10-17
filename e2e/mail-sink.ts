import { createServer, type Server } from "node:http";

// Nepserver die de Resend-aanroepen van de app opvangt (RESEND_API_URL in playwright.config.ts).
export const MAIL_SINK_PORT = Number(process.env.E2E_MAIL_SINK_PORT ?? 4010);
export const E2E_ADMIN_EMAIL = "admin-e2e@example.com";

export type SentMail = { to: string; subject: string; text: string };

const sent: SentMail[] = [];
let server: Server | undefined;

export async function startMailSink() {
  sent.length = 0;
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { to, subject, text } = JSON.parse(body) as SentMail;
        sent.push({ to, subject, text });
      } catch {
        // Onleesbare aanroepen negeren.
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end('{"id":"e2e"}');
    });
  });
  await new Promise<void>((resolve) => server!.listen(MAIL_SINK_PORT, "127.0.0.1", resolve));
}

export async function stopMailSink() {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
}

export const sentTo = (to: string) => sent.filter((mail) => mail.to === to);

/** Wacht tot er een mail aan `to` met dit onderwerp is aangekomen. */
export async function waitForSent(to: string, subject: RegExp, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = sentTo(to).find((mail) => subject.test(mail.subject));
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Geen mail aan ${to} met onderwerp ${subject} binnen ${timeout} ms`);
}
