import { describe, expect, it } from "vitest";
import { KVK_DUPLICATE_MESSAGE, formatPhone, isKvkDuplicate, vendorDetailsSchema } from "@/lib/schemas/vendor-details";

const base = {
  kvk: "12345678",
  vat_number: "",
  postal_code: "1012 JS",
  house_number: "1",
  house_number_addition: "",
  street: "Dam",
  city: "Amsterdam",
  phone: "0612345678",
  website: "",
  contact_email: "info@voorbeeld.nl",
};

const parse = (overrides: Record<string, string> = {}) => vendorDetailsSchema.safeParse({ ...base, ...overrides });
const field = <K extends keyof typeof base>(key: K, value: string) => {
  const result = parse({ [key]: value });
  return result.success ? { ok: true as const, value: result.data[key as keyof typeof result.data] } : { ok: false as const };
};

describe("voorbeelden uit de opdracht", () => {
  it("KvK: '1234 5678' is geldig en wordt 12345678, '1234567' is een fout", () => {
    expect(field("kvk", "1234 5678")).toEqual({ ok: true, value: "12345678" });
    expect(field("kvk", "1234567").ok).toBe(false);
  });

  it("postcode: '1234 SS' is een fout, '1234ab' wordt '1234 AB'", () => {
    expect(field("postal_code", "1234 SS").ok).toBe(false);
    expect(field("postal_code", "1234ab")).toEqual({ ok: true, value: "1234 AB" });
  });

  it("telefoon: '0612345678' wordt '+31612345678'", () => {
    expect(field("phone", "0612345678")).toEqual({ ok: true, value: "+31612345678" });
  });

  it("website: 'minameet.nl' wordt 'https://minameet.nl', 'javascript:alert(1)' is een fout", () => {
    expect(field("website", "minameet.nl")).toEqual({ ok: true, value: "https://minameet.nl" });
    expect(field("website", "javascript:alert(1)").ok).toBe(false);
  });

  it("btw: hoofdletters zonder spaties of punten", () => {
    expect(field("vat_number", "nl 1234.56789 b01")).toEqual({ ok: true, value: "NL123456789B01" });
    expect(field("vat_number", "")).toEqual({ ok: true, value: null });
  });
});

describe("formatPhone", () => {
  it("toont Nederlandse nummers in het nationale formaat", () => {
    expect(formatPhone("+31612345678")).toBe("06 12345678");
    expect(formatPhone("+31201234567")).toBe("020 123 4567");
  });

  it("toont buitenlandse nummers internationaal", () => {
    expect(formatPhone("+32470123456")).toBe("+32 470 12 34 56");
  });

  it("geeft een leeg veld of onleesbare invoer ongewijzigd terug", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone(null)).toBe("");
    expect(formatPhone("abc")).toBe("abc");
  });

  it("is het omgekeerde van het opslaan (weergave en opslag blijven gelijk)", () => {
    const stored = field("phone", "06 12345678");
    expect(stored.ok && formatPhone(stored.value as string)).toBe("06 12345678");
  });
});

describe("isKvkDuplicate", () => {
  it("herkent de unieke-sleutelfout op het KvK-nummer", () => {
    expect(isKvkDuplicate({ code: "23505", message: 'duplicate key value violates unique constraint "vendor_details_kvk_key"' })).toBe(true);
    expect(isKvkDuplicate({ code: "23505", message: "duplicate key", details: "Key (kvk)=(12345678) already exists." })).toBe(true);
  });

  it("negeert andere fouten", () => {
    expect(isKvkDuplicate({ code: "23505", message: 'violates unique constraint "vendors_slug_key"' })).toBe(false);
    expect(isKvkDuplicate({ code: "42501", message: "vendor_details_kvk_key" })).toBe(false);
    expect(isKvkDuplicate(null)).toBe(false);
    expect(isKvkDuplicate(undefined)).toBe(false);
  });

  it("heeft de afgesproken melding", () => {
    expect(KVK_DUPLICATE_MESSAGE).toBe("Dit KvK-nummer is al aangemeld. Neem contact op als dit niet klopt.");
  });
});
