import { isCategory, PRICE_MODELS, type CategoryDb } from "@/lib/listing-fields";
import { parsePriceCents, type ParseResult } from "@/lib/schemas/agenda";

export type ServiceInput = { category: CategoryDb; price_model: (typeof PRICE_MODELS)[number]["value"]; base_price_cents: number | null };

const MODELS = PRICE_MODELS.map((m) => m.value as string);

/**
 * Leest de dienstenstap van de instelassistent: per gekozen categorie een prijsmodel en een optionele prijs.
 * Velden: `category` (meermaals), `price_model_<categorie>` en `price_<categorie>`.
 */
export function parseServices(selected: unknown[], fields: Record<string, unknown>): ParseResult<ServiceInput[]> {
  const errors: Record<string, string> = {};
  const services: ServiceInput[] = [];
  const seen = new Set<string>();

  for (const category of selected) {
    if (!isCategory(category)) {
      errors.category = "Ongeldige keuze";
      continue;
    }
    if (seen.has(category)) continue;
    seen.add(category);

    const model = fields[`price_model_${category}`];
    if (typeof model !== "string" || !MODELS.includes(model)) {
      errors[`price_model_${category}`] = "Kies hoe je de prijs rekent";
      continue;
    }
    const raw = fields[`price_${category}`];
    const price = parsePriceCents(typeof raw === "string" ? raw : "");
    if (price === undefined) {
      errors[`price_${category}`] = "Vul een geldig bedrag in";
      continue;
    }
    services.push({ category, price_model: model as ServiceInput["price_model"], base_price_cents: price });
  }

  if (Object.keys(errors).length) return { success: false, errors };
  if (!services.length) return { success: false, errors: { category: "Kies minstens één dienst, of sla deze stap over." } };
  return { success: true, data: services };
}
