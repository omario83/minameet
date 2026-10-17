import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Het adres waarheen de laatste bevestigingsmail ging, ondertekend zodat het niet via een URL of cookie te vervalsen is.
const COOKIE = "mm_pending_email";
const MAX_AGE_SECONDS = 60 * 60;

export function resendCooldownSeconds() {
  const raw = process.env.AUTH_RESEND_COOLDOWN_SECONDS;
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : 60;
}

let warnedDevSecret = false;

function secret() {
  const value = process.env.AUTH_COOKIE_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_COOKIE_SECRET ontbreekt");
  if (!warnedDevSecret) {
    warnedDevSecret = true;
    console.warn("[auth] AUTH_COOKIE_SECRET ontbreekt: een vaste ontwikkelsleutel wordt gebruikt (alleen toegestaan in development).");
  }
  return "alleen-voor-development";
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** `sentAt` 0 betekent: er is (nog) geen mail verstuurd, dus geen wachttijd. */
export async function setPendingEmail(email: string, sentAt = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ e: email, t: sentAt, i: Date.now() })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/leverancier",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getPendingEmail(): Promise<{ email: string; sentAt: number } | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  const [payload, mac] = raw?.split(".") ?? [];
  if (!payload || !mac) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const { e, t, i } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { e?: unknown; t?: unknown; i?: unknown };
    if (typeof e !== "string" || typeof t !== "number" || typeof i !== "number") return null;
    if (Date.now() - i > MAX_AGE_SECONDS * 1000) return null;
    return { email: e, sentAt: t };
  } catch {
    return null;
  }
}

/** Het adres en de resterende wachttijd (seconden) voor de pagina 'controleer je e-mail'. */
export async function getResendStatus() {
  const pending = await getPendingEmail();
  const secondsLeft = pending?.sentAt ? Math.max(0, Math.ceil(resendCooldownSeconds() - (Date.now() - pending.sentAt) / 1000)) : 0;
  return { email: pending?.email ?? null, secondsLeft };
}
