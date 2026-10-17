export type AuthRole = "customer" | "vendor" | "admin";

/** Enige paden waarheen een link uit een e-mail mag doorsturen. Exacte match: geen extern adres, geen query. */
export const CALLBACK_NEXT_PATHS = [
  "/leverancier/aanmelden",
  "/leverancier/dashboard",
  "/leverancier/wachtwoord-resetten",
  "/account",
] as const;

/** Eerste bestemming van een partner; de portal stuurt een nieuwe partner vanaf hier naar de instelassistent. */
export const VENDOR_HOME_PATH = "/leverancier/dashboard";
export const VENDOR_RESET_PATH = "/leverancier/wachtwoord-resetten";

const ROLE_AREA: Record<AuthRole, string> = { customer: "/account", vendor: "/leverancier", admin: "/admin" };

/** Geeft `value` terug als het op de vaste lijst staat (en bij `role` in het eigen gebied ligt), anders null. */
export function callbackNext(value: unknown, role?: AuthRole): string | null {
  if (typeof value !== "string" || !(CALLBACK_NEXT_PATHS as readonly string[]).includes(value)) return null;
  if (role) {
    const area = ROLE_AREA[role];
    if (value !== area && !value.startsWith(`${area}/`)) return null;
  }
  return value;
}

/** Waar een partner of klant heen gaat als de link uit de mail niet (meer) werkt. */
export function callbackFailurePath(next: unknown): string {
  const path = callbackNext(next);
  if (path === VENDOR_RESET_PATH) return "/leverancier/wachtwoord-vergeten?melding=link-verlopen";
  if (path?.startsWith("/leverancier")) return "/leverancier/inloggen?melding=link-verlopen";
  return "/inloggen?melding=link-verlopen";
}

/** Bestemming na inloggen van een partner: het gevraagde pad of het dashboard. */
export function vendorLoginDestination(requested: string | null): string {
  return requested ?? VENDOR_HOME_PATH;
}
