import { describe, expect, it } from "vitest";
import { parseServices } from "@/lib/schemas/setup";

describe("parseServices", () => {
  it("leest prijsmodel en prijs per gekozen dienst", () => {
    const result = parseServices(["venue", "dj"], { price_model_venue: "fixed", price_venue: "1500", price_model_dj: "per_hour", price_dj: "" });
    expect(result).toEqual({
      success: true,
      data: [
        { category: "venue", price_model: "fixed", base_price_cents: 150000 },
        { category: "dj", price_model: "per_hour", base_price_cents: null },
      ],
    });
  });

  it("vraagt om minstens één dienst", () => {
    expect(parseServices([], {})).toMatchObject({ success: false, errors: { category: expect.any(String) } });
  });

  it("weigert een ongeldig bedrag, prijsmodel of categorie", () => {
    expect(parseServices(["venue"], { price_model_venue: "fixed", price_venue: "abc" })).toMatchObject({ success: false, errors: { price_venue: expect.any(String) } });
    expect(parseServices(["venue"], { price_model_venue: "gratis", price_venue: "1" })).toMatchObject({ success: false, errors: { price_model_venue: expect.any(String) } });
    expect(parseServices(["spaceship"], {})).toMatchObject({ success: false, errors: { category: "Ongeldige keuze" } });
  });

  it("negeert dubbele categorieën", () => {
    const result = parseServices(["dj", "dj"], { price_model_dj: "fixed", price_dj: "10" });
    expect(result.success && result.data).toHaveLength(1);
  });
});
