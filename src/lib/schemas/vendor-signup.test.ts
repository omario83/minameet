import { describe, expect, it } from "vitest";
import { passwordStrength } from "@/lib/password-strength";
import { fieldErrors } from "@/lib/schemas/errors";
import { vendorSignUpSchema } from "@/lib/schemas/vendor-signup";

const valid = {
  full_name: "Aylin Demir",
  company_name: "Zaal Het Oosten",
  category: "venue",
  email: "  Info@Voorbeeld.NL ",
  password: "abcdefghij",
  terms: "on",
};

const parse = (overrides: Record<string, string | undefined> = {}) => vendorSignUpSchema.safeParse({ ...valid, ...overrides });

function errorsFor(overrides: Record<string, string | undefined>) {
  const result = parse(overrides);
  return result.success ? {} : fieldErrors(result.error);
}

describe("vendorSignUpSchema", () => {
  it("accepteert geldige invoer en normaliseert het e-mailadres", () => {
    const result = parse();
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe("info@voorbeeld.nl");
  });

  it("weigert een ongeldig e-mailadres", () => {
    for (const email of ["", "geen-email", "a@", "a@b", "a b@c.nl"]) {
      expect(errorsFor({ email }).email, email).toBe("Vul een geldig e-mailadres in");
    }
  });

  it("eist minimaal 10 tekens voor het wachtwoord", () => {
    expect(errorsFor({ password: "123456789" }).password).toMatch(/minimaal 10/);
    expect(errorsFor({ password: "1234567890" }).password).toBeUndefined();
  });

  it("begrenst het wachtwoord op 72 tekens", () => {
    expect(errorsFor({ password: "a".repeat(72) }).password).toBeUndefined();
    expect(errorsFor({ password: "a".repeat(73) }).password).toMatch(/maximaal 72/);
  });

  it("eist het vinkje voor de voorwaarden", () => {
    const missing = errorsFor({ terms: undefined }).terms;
    expect(missing).toMatch(/partnervoorwaarden/);
    expect(errorsFor({ terms: "off" }).terms).toMatch(/partnervoorwaarden/);
    expect(errorsFor({ terms: "on" }).terms).toBeUndefined();
  });

  it("weigert een bedrijfsnaam van 1 teken en trimt spaties", () => {
    expect(errorsFor({ company_name: "A" }).company_name).toMatch(/minimaal 2/);
    expect(errorsFor({ company_name: "  A  " }).company_name).toMatch(/minimaal 2/);
    expect(errorsFor({ company_name: "x".repeat(100) }).company_name).toBeUndefined();
    expect(errorsFor({ company_name: "x".repeat(101) }).company_name).toMatch(/maximaal 100/);
  });

  it("begrenst de naam van de contactpersoon op 2 tot 80 tekens", () => {
    expect(errorsFor({ full_name: "A" }).full_name).toMatch(/minimaal 2/);
    expect(errorsFor({ full_name: "x".repeat(80) }).full_name).toBeUndefined();
    expect(errorsFor({ full_name: "x".repeat(81) }).full_name).toMatch(/maximaal 80/);
  });

  it("weigert een onbekende categorie", () => {
    for (const category of ["", "admin", "Venue", "venue; drop table vendors"]) {
      expect(errorsFor({ category }).category, category).toBe("Kies een categorie");
    }
    expect(errorsFor({ category: "other" }).category).toBeUndefined();
  });

  it("geeft per veld één melding", () => {
    expect(Object.keys(errorsFor({ email: "x", password: "x", terms: undefined, category: "" })).sort()).toEqual([
      "category",
      "email",
      "password",
      "terms",
    ]);
  });
});

describe("passwordStrength", () => {
  it("noemt een te kort wachtwoord te kort", () => {
    expect(passwordStrength("Ab1!").score).toBe(0);
    expect(passwordStrength("").label).toBe("Te kort");
  });

  it("beoordeelt herhaling en reeksen als zwak", () => {
    expect(passwordStrength("aaaaaaaaaaaaaaaaaaaa").score).toBe(1);
    expect(passwordStrength("1234567890123").score).toBe(1);
  });

  it("waardeert lengte en variatie", () => {
    expect(passwordStrength("abcdefghij").score).toBe(1);
    expect(passwordStrength("Zebra-wolk-77").score).toBe(2);
    expect(passwordStrength("Zebra-wolk-nacht-77").score).toBeGreaterThanOrEqual(3);
    expect(passwordStrength("Correct-Horse-Battery-9").score).toBe(4);
  });
});
