import type { Category } from "@/lib/categories";

export type CategoryDb = Category["db"];

export type FieldDef = {
  key: string;
  label: string;
  type: "number" | "boolean" | "text" | "select";
  options?: { value: string; label: string }[];
  hint?: string;
};

export const PRICE_MODELS = [
  { value: "fixed", label: "Vast bedrag" },
  { value: "per_person", label: "Per persoon" },
  { value: "per_hour", label: "Per uur" },
  { value: "from", label: "Vanaf-prijs" },
] as const;

// Categoriespecifieke velden; worden opgeslagen in listings.attributes.
export const FIELDS: Record<CategoryDb, FieldDef[]> = {
  venue: [
    { key: "halls_count", label: "Aantal zalen", type: "number" },
    { key: "seated_capacity", label: "Zitplaatsen", type: "number" },
    { key: "standing_capacity", label: "Staplaatsen", type: "number" },
    { key: "area_m2", label: "Oppervlakte (m²)", type: "number" },
    { key: "parking_spots", label: "Parkeerplaatsen", type: "number" },
    { key: "has_stage", label: "Podium aanwezig", type: "boolean" },
    { key: "has_dance_floor", label: "Dansvloer aanwezig", type: "boolean" },
    { key: "has_kitchen", label: "Keuken aanwezig", type: "boolean" },
    { key: "halal_kitchen", label: "Halal keuken", type: "boolean" },
    { key: "own_catering_allowed", label: "Eigen catering toegestaan", type: "boolean" },
    { key: "separate_seating", label: "Gescheiden opstelling mogelijk", type: "boolean" },
    { key: "wheelchair_accessible", label: "Rolstoeltoegankelijk", type: "boolean" },
  ],
  catering: [
    { key: "cuisine", label: "Keuken", type: "text", hint: "Bijvoorbeeld: Turks, Marokkaans, Surinaams" },
    {
      key: "serving_style",
      label: "Serveerstijl",
      type: "select",
      options: [
        { value: "buffet", label: "Buffet" },
        { value: "diner", label: "Gezeten diner" },
        { value: "walking", label: "Walking dinner" },
        { value: "high_tea", label: "High tea" },
      ],
    },
    { key: "halal", label: "Halal", type: "boolean" },
    { key: "vegetarian", label: "Vegetarische opties", type: "boolean" },
    { key: "vegan", label: "Veganistische opties", type: "boolean" },
    { key: "staff_included", label: "Personeel inbegrepen", type: "boolean" },
    { key: "delivery_available", label: "Bezorgen mogelijk", type: "boolean" },
  ],
  dj: [
    { key: "genres", label: "Genres", type: "text", hint: "Gescheiden door komma's" },
    { key: "languages", label: "Talen", type: "text" },
    { key: "hours_included", label: "Uren inbegrepen", type: "number" },
    { key: "sound_system", label: "Geluidsset inbegrepen", type: "boolean" },
    { key: "lighting", label: "Lichtshow inbegrepen", type: "boolean" },
    { key: "live_instruments", label: "Live instrumenten", type: "boolean" },
    { key: "mc_available", label: "Ceremoniemeester/MC", type: "boolean" },
  ],
  photographer: [
    { key: "hours_included", label: "Uren inbegrepen", type: "number" },
    { key: "edited_photos", label: "Aantal bewerkte foto's", type: "number" },
    { key: "delivery_days", label: "Levertijd (dagen)", type: "number" },
    { key: "photo", label: "Fotografie", type: "boolean" },
    { key: "video", label: "Video", type: "boolean" },
    { key: "drone", label: "Drone", type: "boolean" },
  ],
  decor: [
    { key: "styles", label: "Stijlen", type: "text", hint: "Gescheiden door komma's" },
    { key: "flowers", label: "Bloemen inbegrepen", type: "boolean" },
    { key: "lighting", label: "Verlichting inbegrepen", type: "boolean" },
    { key: "setup_included", label: "Opbouw inbegrepen", type: "boolean" },
    { key: "teardown_included", label: "Afbouw inbegrepen", type: "boolean" },
  ],
  other: [{ key: "service_type", label: "Soort dienst", type: "text", hint: "Bijvoorbeeld: taart, vervoer, entertainment" }],
};

export function isCategory(value: unknown): value is CategoryDb {
  return typeof value === "string" && value in FIELDS;
}

type AttributeValue = number | boolean | string;

export function parseAttributes(
  category: CategoryDb,
  formData: FormData,
): { values: Record<string, AttributeValue> } | { error: string } {
  const values: Record<string, AttributeValue> = {};

  for (const field of FIELDS[category]) {
    const raw = formData.get(`attr_${field.key}`);

    if (field.type === "boolean") {
      if (raw === "on") values[field.key] = true;
      continue;
    }

    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) continue;

    if (field.type === "number") {
      const n = Number(text);
      if (!Number.isFinite(n) || n < 0) return { error: `${field.label}: vul een geldig getal in` };
      values[field.key] = n;
    } else if (field.type === "select") {
      if (!field.options?.some((o) => o.value === text)) return { error: `${field.label}: ongeldige keuze` };
      values[field.key] = text;
    } else {
      if (text.length > 200) return { error: `${field.label}: maximaal 200 tekens` };
      values[field.key] = text;
    }
  }

  return { values };
}
