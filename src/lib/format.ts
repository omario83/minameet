export function eur(cents: number | null | undefined) {
  if (cents == null) return "Op aanvraag";
  return `€ ${(cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: string | null | undefined) {
  if (!date) return "Nog niet bekend";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date.slice(0, 10)}T00:00:00Z`),
  );
}

/** Geschat totaal in centen; null als het niet te bepalen is (bijv. per uur). */
export function estimateTotal(model: string, priceCents: number | null, guests?: number | null) {
  if (priceCents == null) return null;
  if (model === "per_person") return guests ? priceCents * guests : null;
  if (model === "per_hour") return null;
  return priceCents;
}

export const PRICE_SUFFIX: Record<string, string> = {
  fixed: "",
  per_person: " p.p.",
  per_hour: " per uur",
  from: " vanaf",
};
