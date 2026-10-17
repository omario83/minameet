import { houseNumberSchema, postalCodeSchema } from "@/lib/schemas/vendor-details";

export type AddressLookup = { found: true; street: string; city: string } | { found: false };

export const PDOK_DEFAULT_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";
export const PDOK_TIMEOUT_MS = 5000;

type PdokResponse = { response?: { docs?: { straatnaam?: unknown; woonplaatsnaam?: unknown }[] } };

/**
 * Zoekt straat en plaats bij postcode + huisnummer via de PDOK Locatieserver.
 * Bij geen resultaat, een fout of een time-out is het antwoord `found: false`: de partner vult dan zelf in.
 * `url` en `timeoutMs` zijn instelbaar voor tests.
 */
export async function fetchAddress(
  postcode: string,
  houseNumber: number,
  { url = PDOK_DEFAULT_URL, timeoutMs = PDOK_TIMEOUT_MS }: { url?: string; timeoutMs?: number } = {},
): Promise<AddressLookup> {
  const pc = postalCodeSchema.safeParse(postcode);
  const nr = houseNumberSchema.safeParse(String(houseNumber));
  if (!pc.success || !nr.success) return { found: false };

  // Beide waarden zijn hierboven gevalideerd, er komt geen vrije tekst in de zoekopdracht.
  const query = new URLSearchParams({
    q: `postcode:${pc.data.replace(" ", "")} AND huisnummer:${nr.data}`,
    fq: "type:adres",
    rows: "1",
    fl: "straatnaam,woonplaatsnaam",
  });

  try {
    const res = await fetch(`${url}?${query}`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (!res.ok) return { found: false };
    const doc = ((await res.json()) as PdokResponse).response?.docs?.[0];
    if (typeof doc?.straatnaam === "string" && typeof doc.woonplaatsnaam === "string") {
      return { found: true, street: doc.straatnaam, city: doc.woonplaatsnaam };
    }
  } catch {
    // Time-out of netwerkfout.
  }
  return { found: false };
}
