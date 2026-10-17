// Controle van het adres van een externe kalender (iCal). Pure functies: de netwerkcontrole staat in feed-sync.ts.

export const MAX_FEED_URL_LENGTH = 2000;

export type FeedUrlResult = { ok: true; url: string } | { ok: false; error: string };

/** Maakt van wat de partner plakt een https-adres, of geeft een foutmelding. webcal:// wordt https://. */
export function normalizeFeedUrl(raw: string): FeedUrlResult {
  let text = raw.trim();
  if (!text) return { ok: false, error: "Plak het iCal-adres van je kalender" };
  if (text.length > MAX_FEED_URL_LENGTH) return { ok: false, error: "Dit adres is te lang" };
  text = text.replace(/^webcals?:\/\//i, "https://");

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "Dit is geen geldig webadres" };
  }

  if (url.protocol !== "https:") return { ok: false, error: "Het adres moet met https:// of webcal:// beginnen" };
  if (url.username || url.password) return { ok: false, error: "Een adres met gebruikersnaam of wachtwoord wordt niet ondersteund" };
  if (url.port && url.port !== "443") return { ok: false, error: "Dit adres wordt niet ondersteund" };

  const host = url.hostname;
  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[");
  if (!host.includes(".") || isIpLiteral || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, error: "Gebruik het adres dat je kalender-app geeft (een webadres, geen IP-adres)" };
  }
  return { ok: true, url: url.toString() };
}

function ipv4ToNumber(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

const PRIVATE_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
];

/** Is dit een adres waar een server niet naartoe mag verbinden (lokaal, privé, link-local, multicast)? */
export function isPrivateAddress(ip: string): boolean {
  const lower = ip.toLowerCase();

  const mapped = /^(?:::ffff:|0:0:0:0:0:ffff:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower);
  if (mapped) return isPrivateAddress(mapped[1]);

  if (!lower.includes(":")) {
    const value = ipv4ToNumber(lower);
    if (value === null) return true;
    return PRIVATE_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) >>> 0 === ((ipv4ToNumber(base) as number) & mask) >>> 0;
    });
  }

  if (lower === "::" || lower === "::1") return true;
  const first = parseInt(lower.split(":")[0] || "0", 16);
  if (Number.isNaN(first)) return true;
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00;
}
