import { describe, expect, it } from "vitest";
import { callbackFailurePath, callbackNext, vendorLoginDestination } from "@/lib/redirects";

describe("callbackNext", () => {
  it("laat alleen paden van de vaste lijst door", () => {
    expect(callbackNext("/leverancier/aanmelden")).toBe("/leverancier/aanmelden");
    expect(callbackNext("/leverancier/wachtwoord-resetten")).toBe("/leverancier/wachtwoord-resetten");
    expect(callbackNext("/account")).toBe("/account");
  });

  it.each([
    "https://evil.com",
    "http://evil.com/leverancier/aanmelden",
    "//evil.com",
    "/\\evil.com",
    "/leverancier/aanmelden/../../evil",
    "/leverancier/aanmelden?x=1",
    "/leverancier/aanmelden/",
    "/leverancier/aanbod",
    "/admin",
    "javascript:alert(1)",
    "",
  ])("negeert %j", (value) => {
    expect(callbackNext(value)).toBeNull();
  });

  it("negeert niet-tekstwaarden", () => {
    for (const value of [null, undefined, 1, {}, ["/account"]]) expect(callbackNext(value)).toBeNull();
  });

  it("houdt een rol binnen het eigen gebied", () => {
    expect(callbackNext("/leverancier/aanmelden", "vendor")).toBe("/leverancier/aanmelden");
    expect(callbackNext("/leverancier/aanmelden", "customer")).toBeNull();
    expect(callbackNext("/account", "vendor")).toBeNull();
    expect(callbackNext("/account", "customer")).toBe("/account");
  });
});

describe("callbackFailurePath", () => {
  it("stuurt een partner naar de partnerlogin met de melding", () => {
    expect(callbackFailurePath("/leverancier/aanmelden")).toBe("/leverancier/inloggen?melding=link-verlopen");
    expect(callbackFailurePath("/leverancier/dashboard")).toBe("/leverancier/inloggen?melding=link-verlopen");
  });

  it("stuurt een mislukte wachtwoordlink naar een nieuwe aanvraag", () => {
    expect(callbackFailurePath("/leverancier/wachtwoord-resetten")).toBe("/leverancier/wachtwoord-vergeten?melding=link-verlopen");
  });

  it("stuurt een klant, een onbekend of kwaadaardig pad naar de klantlogin", () => {
    for (const next of ["/account", null, "", "https://evil.com", "//evil.com", "/leverancier/aanbod"]) {
      expect(callbackFailurePath(next)).toBe("/inloggen?melding=link-verlopen");
    }
  });

  it("verwijst nooit naar een extern adres", () => {
    for (const next of ["https://evil.com", "//evil.com", "/\\evil.com"]) {
      expect(callbackFailurePath(next)).not.toMatch(/evil/);
    }
  });
});

describe("vendorLoginDestination", () => {
  it("stuurt een partner naar het dashboard", () => {
    expect(vendorLoginDestination(null)).toBe("/leverancier/dashboard");
  });

  it("gebruikt het gevraagde pad als dat er is", () => {
    expect(vendorLoginDestination("/leverancier/aanbod")).toBe("/leverancier/aanbod");
  });
});
