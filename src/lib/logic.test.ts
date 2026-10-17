import { describe, expect, it } from "vitest";
import { parseQueryHeuristic } from "@/lib/ai/parse-query";
import { estimateTotal } from "@/lib/format";
import { parseAttributes } from "@/lib/listing-fields";
import { safeNext } from "@/lib/auth";
import { sniffImage } from "@/lib/photos";

describe("safeNext", () => {
  it("laat alleen eigen paden binnen het gebied van de rol toe", () => {
    expect(safeNext("/account/offerte/nieuw?id=1", "customer")).toBe("/account/offerte/nieuw?id=1");
    expect(safeNext("/leverancier/dashboard", "vendor")).toBe("/leverancier/dashboard");
  });

  it("weigert externe, dubbele-slash en verkeerde gebieden", () => {
    expect(safeNext("https://evil.nl", "customer")).toBeNull();
    expect(safeNext("//evil.nl", "customer")).toBeNull();
    expect(safeNext("/\\evil.nl", "customer")).toBeNull();
    expect(safeNext("/admin", "customer")).toBeNull();
    expect(safeNext("/accountx", "customer")).toBeNull();
    expect(safeNext(null, "customer")).toBeNull();
  });
});

describe("sniffImage", () => {
  it("herkent echte afbeeldingen aan de eerste bytes", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))?.ext).toBe("png");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBP"))?.ext).toBe("webp");
  });

  it("weigert andere bestanden", () => {
    expect(sniffImage(new TextEncoder().encode("<svg xmlns"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("MZ\x90\0exe"))).toBeNull();
  });
});

describe("parseQueryHeuristic", () => {
  it("haalt cultuur, gasten, plaats en categorieën uit een bruiloftszoekopdracht", () => {
    const q = parseQueryHeuristic("Turkse bruiloft voor 250 gasten in Rotterdam");
    expect(q.culture).toBe("turks");
    expect(q.event_type).toBe("bruiloft");
    expect(q.guests).toBe(250);
    expect(q.city).toBe("rotterdam");
    expect(q.categories).toEqual(["venue", "catering", "dj", "photographer"]);
  });

  it("herkent halal, budget en een datum", () => {
    const q = parseQueryHeuristic("halal diner 80 personen budget 4.000 op 12-06-2027");
    expect(q.halal).toBe(true);
    expect(q.guests).toBe(80);
    expect(q.budget_eur).toBe(4000);
    expect(q.date).toBe("2027-06-12");
    expect(q.categories).toEqual(["catering"]);
  });

  it("geeft lege filters bij onbegrijpelijke tekst", () => {
    const q = parseQueryHeuristic("hallo");
    expect(q.categories).toEqual([]);
    expect(q.guests).toBeNull();
  });
});

describe("estimateTotal", () => {
  it("rekent per persoon uit en laat per uur leeg", () => {
    expect(estimateTotal("per_person", 5000, 100)).toBe(500000);
    expect(estimateTotal("per_person", 5000, null)).toBeNull();
    expect(estimateTotal("per_hour", 5000, 100)).toBeNull();
    expect(estimateTotal("fixed", 120000, 100)).toBe(120000);
  });
});

describe("parseAttributes", () => {
  const form = (entries: Record<string, string>) => {
    const f = new FormData();
    Object.entries(entries).forEach(([k, v]) => f.set(k, v));
    return f;
  };

  it("leest getallen en vinkjes per categorie", () => {
    const r = parseAttributes("venue", form({ attr_seated_capacity: "300", attr_halal_kitchen: "on" }));
    expect(r).toEqual({ values: { seated_capacity: 300, halal_kitchen: true } });
  });

  it("weigert negatieve getallen en ongeldige keuzes", () => {
    expect(parseAttributes("venue", form({ attr_area_m2: "-5" }))).toHaveProperty("error");
    expect(parseAttributes("catering", form({ attr_serving_style: "onzin" }))).toHaveProperty("error");
  });

  it("negeert velden van een andere categorie", () => {
    expect(parseAttributes("dj", form({ attr_seated_capacity: "300" }))).toEqual({ values: {} });
  });
});
