import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateTotal, formatDate } from "@/lib/format";
import type { CategoryDb } from "@/lib/listing-fields";

export type Filters = {
  categories: CategoryDb[];
  date?: string | null;
  guests?: number | null;
  budgetEur?: number | null;
  city?: string | null;
  culture?: string | null;
  halal?: boolean;
};

export type Hit = {
  id: string;
  category: CategoryDb;
  title: string;
  description: string | null;
  price_model: string;
  base_price_cents: number | null;
  min_guests: number | null;
  max_guests: number | null;
  attributes: Record<string, unknown>;
  photos: string[];
  vendor: { id: string; company_name: string; city: string | null; region: string | null; cultural_tags: string[] };
  availability: "free" | "option" | "unknown";
  estimateCents: number | null;
  reasons: string[];
  score: number;
};

const SELECT =
  "id, category, title, description, price_model, base_price_cents, min_guests, max_guests, attributes, photos, vendors!inner(id, company_name, city, region, cultural_tags)";

export async function searchListings(supabase: SupabaseClient, f: Filters): Promise<Hit[]> {
  let query = supabase.from("listings").select(SELECT).eq("is_published", true).limit(80);

  if (f.categories.length) query = query.in("category", f.categories);
  if (f.guests) {
    query = query.or(`max_guests.is.null,max_guests.gte.${f.guests}`).or(`min_guests.is.null,min_guests.lte.${f.guests}`);
  }
  if (f.city) query = query.ilike("vendors.city", `%${f.city.replace(/[%_]/g, "")}%`);

  const { data } = await query;
  const rows = (data ?? []) as unknown as (Omit<Hit, "vendor" | "availability" | "estimateCents" | "reasons" | "score"> & {
    vendors: Hit["vendor"];
  })[];

  const busy = new Map<string, string>();
  if (f.date && rows.length) {
    const { data: av } = await supabase
      .from("availability")
      .select("listing_id, status")
      .eq("date", f.date)
      .in("listing_id", rows.map((r) => r.id));
    (av ?? []).forEach((a) => busy.set(a.listing_id, a.status));
  }

  const singleCategory = f.categories.length === 1;
  const culture = f.culture?.toLowerCase();
  const hits: Hit[] = [];

  for (const row of rows) {
    const status = busy.get(row.id);
    if (status === "booked") continue;

    const estimateCents = estimateTotal(row.price_model, row.base_price_cents, f.guests);
    if (singleCategory && f.budgetEur && estimateCents != null && estimateCents > f.budgetEur * 100) continue;

    const reasons: string[] = [];
    let score = 0;
    const tags = (row.vendors.cultural_tags ?? []).map((t) => t.toLowerCase());

    if (culture && tags.some((t) => t.includes(culture.slice(0, -1)))) {
      reasons.push(`Specialist in ${f.culture}`);
      score += 3;
    }
    if (f.halal && (row.attributes.halal === true || row.attributes.halal_kitchen === true)) {
      reasons.push("Halal");
      score += 2;
    }
    if (f.guests && row.max_guests) reasons.push(`Past bij ${f.guests} gasten (max. ${row.max_guests})`);
    if (f.date) {
      if (status === "option") score -= 1;
      else {
        reasons.push(`Vrij op ${formatDate(f.date)}`);
        score += 1;
      }
    }

    hits.push({
      id: row.id,
      category: row.category,
      title: row.title,
      description: row.description,
      price_model: row.price_model,
      base_price_cents: row.base_price_cents,
      min_guests: row.min_guests,
      max_guests: row.max_guests,
      attributes: row.attributes ?? {},
      photos: row.photos ?? [],
      vendor: row.vendors,
      availability: f.date ? (status === "option" ? "option" : "free") : "unknown",
      estimateCents,
      reasons,
      score,
    });
  }

  return hits.sort((a, b) => b.score - a.score);
}
