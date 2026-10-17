// De volledige metadata: de standaardset accepteert te korte nummers zoals "12345".
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { z } from "zod";

// Dit bestand wordt ook in de browser gebruikt: geen server-only imports.

export const POSTCODE_RE = /^[1-9][0-9]{3} ?(?!SA|SD|SS)[A-Z]{2}$/;

const required = (label: string) => z.string().trim().min(1, `Vul ${label} in`);

const kvk = z
  .string()
  .transform((v) => v.replace(/[\s.]/g, ""))
  .pipe(z.string().regex(/^\d{8}$/, "Een KvK-nummer bestaat uit precies 8 cijfers"));

const vatNumber = z
  .string()
  .transform((v) => v.replace(/[\s.]/g, "").toUpperCase())
  .pipe(z.string().regex(/^(NL\d{9}B\d{2})?$/, "Gebruik het formaat NL123456789B01"))
  .transform((v) => v || null);

const postalCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(POSTCODE_RE, "Vul een geldige postcode in, bijvoorbeeld 1234 AB")
  .transform((v) => `${v.slice(0, 4)} ${v.slice(-2)}`);

const houseNumber = z
  .string()
  .trim()
  .regex(/^[1-9]\d{0,4}$/, "Vul een geldig huisnummer in")
  .transform(Number);

const houseNumberAddition = z
  .string()
  .trim()
  .max(10, "Maximaal 10 tekens")
  .regex(/^[A-Za-z0-9\- ]*$/, "Gebruik alleen letters, cijfers en streepjes")
  .transform((v) => v || null);

const phone = z
  .string()
  .trim()
  .refine((v) => parsePhoneNumberFromString(v, "NL")?.isValid() === true, "Vul een geldig telefoonnummer in")
  .transform((v) => parsePhoneNumberFromString(v, "NL")!.number);

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

// Alleen http(s): de website wordt later als link getoond.
const website = z
  .string()
  .trim()
  .max(200, "Maximaal 200 tekens")
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .refine((v) => v === "" || isHttpUrl(v), "Vul een geldig webadres in, bijvoorbeeld https://www.voorbeeld.nl")
  .transform((v) => v || null);

export const vendorDetailsSchema = z.object({
  kvk,
  vat_number: vatNumber,
  postal_code: postalCode,
  house_number: houseNumber,
  house_number_addition: houseNumberAddition,
  street: required("de straat").max(100, "Maximaal 100 tekens"),
  city: required("de plaats").max(80, "Maximaal 80 tekens"),
  phone,
  website,
  contact_email: z.string().trim().toLowerCase().pipe(z.email("Vul een geldig e-mailadres in")),
});

export type VendorDetails = z.output<typeof vendorDetailsSchema>;

export const postalCodeSchema = postalCode;
export const houseNumberSchema = houseNumber;

/** E.164 naar weergave: Nederlandse nummers als 06 12345678, andere nummers internationaal. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = parsePhoneNumberFromString(value, "NL");
  if (!parsed) return value;
  return parsed.country === "NL" ? parsed.formatNational() : parsed.formatInternational();
}

export const KVK_DUPLICATE_MESSAGE = "Dit KvK-nummer is al aangemeld. Neem contact op als dit niet klopt.";

/** Is dit de unieke-sleutelfout (23505) op het KvK-nummer? */
export function isKvkDuplicate(error: { code?: string; message?: string; details?: string } | null | undefined) {
  if (error?.code !== "23505") return false;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return text.includes("vendor_details_kvk_key") || text.includes("(kvk)");
}
