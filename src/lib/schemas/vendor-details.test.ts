import { describe, expect, it } from "vitest";
import { fieldErrors } from "@/lib/schemas/errors";
import { vendorDetailsSchema } from "@/lib/schemas/vendor-details";

const valid = {
  kvk: "12345678",
  vat_number: "",
  postal_code: "1012 js",
  house_number: "12",
  house_number_addition: "",
  street: "Dam",
  city: "Amsterdam",
  phone: "06 12345678",
  website: "",
  contact_email: "Info@Voorbeeld.nl",
};

const parse = (overrides: Record<string, string> = {}) => vendorDetailsSchema.safeParse({ ...valid, ...overrides });

describe("vendorDetailsSchema", () => {
  it("normaliseert geldige invoer", () => {
    const result = parse();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      kvk: "12345678",
      postal_code: "1012 JS",
      house_number: 12,
      house_number_addition: null,
      phone: "+31612345678",
      website: null,
      vat_number: null,
      contact_email: "info@voorbeeld.nl",
    });
  });

  it("strips spaties en punten uit het KvK-nummer", () => {
    const result = parse({ kvk: "12 345.678" });
    expect(result.success && result.data.kvk).toBe("12345678");
  });

  it.each(["1234567", "123456789", "1234567a", ""])("weigert KvK %j", (kvk) => {
    expect(parse({ kvk }).success).toBe(false);
  });

  it.each(["0123 AB", "1234 SA", "1234 SD", "1234 SS", "123 AB", "1234 A", "12345 AB"])("weigert postcode %j", (postal_code) => {
    expect(parse({ postal_code }).success).toBe(false);
  });

  it.each([["1234ab", "1234 AB"], [" 9999 zz ", "9999 ZZ"]])("forceert hoofdletters en spatie in postcode %j", (input, expected) => {
    const result = parse({ postal_code: input });
    expect(result.success && result.data.postal_code).toBe(expected);
  });

  it("slaat telefoon op als E.164, ook bij +31 en buitenlandse nummers", () => {
    const nl = parse({ phone: "+31 20 123 4567" });
    expect(nl.success && nl.data.phone).toBe("+31201234567");
    expect(parse({ phone: "+32 470 12 34 56" }).success).toBe(true);
    expect(parse({ phone: "12345" }).success).toBe(false);
    expect(parse({ phone: "abc" }).success).toBe(false);
  });

  it("accepteert alleen http(s)-websites en vult https aan", () => {
    const bare = parse({ website: "www.voorbeeld.nl" });
    expect(bare.success && bare.data.website).toBe("https://www.voorbeeld.nl");
    expect(parse({ website: "javascript:alert(1)" }).success).toBe(false);
    expect(parse({ website: "ftp://voorbeeld.nl" }).success).toBe(false);
    expect(parse({ website: "voorbeeld" }).success).toBe(false);
  });

  it("valideert het btw-nummer als dat is ingevuld", () => {
    const ok = parse({ vat_number: "nl 123456789 b01" });
    expect(ok.success && ok.data.vat_number).toBe("NL123456789B01");
    expect(parse({ vat_number: "NL12345" }).success).toBe(false);
  });

  it("valideert huisnummer en toevoeging", () => {
    expect(parse({ house_number: "0" }).success).toBe(false);
    expect(parse({ house_number: "12a" }).success).toBe(false);
    const add = parse({ house_number_addition: "bis" });
    expect(add.success && add.data.house_number_addition).toBe("bis");
    expect(parse({ house_number_addition: "<script>" }).success).toBe(false);
  });

  it("geeft per veld de eerste foutmelding", () => {
    const result = parse({ kvk: "1", street: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(Object.keys(fieldErrors(result.error)).sort()).toEqual(["kvk", "street"]);
  });
});
