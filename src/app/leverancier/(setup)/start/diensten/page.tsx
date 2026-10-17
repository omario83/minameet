import { ServicesForm, type ServiceDefault } from "@/components/setup/services-form";
import { formatPriceInput } from "@/lib/agenda/format";
import { CATEGORIES } from "@/lib/categories";
import { isCategory, type CategoryDb } from "@/lib/listing-fields";
import { getVendor } from "@/lib/vendor";

export default async function SetupServicesPage() {
  const { supabase, vendor } = await getVendor();
  const { data: listings } = await supabase
    .from("listings")
    .select("category, price_model, base_price_cents")
    .eq("vendor_id", vendor.id)
    .order("created_at");

  const initial = Object.fromEntries(
    CATEGORIES.map(({ db }) => {
      const existing = listings?.find((l) => l.category === db);
      const value: ServiceDefault = {
        selected: !!existing || (!listings?.length && isCategory(vendor.primary_category) && vendor.primary_category === db),
        price_model: existing?.price_model ?? "fixed",
        price: formatPriceInput(existing?.base_price_cents),
      };
      return [db, value];
    }),
  ) as Record<CategoryDb, ServiceDefault>;

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Wat bied je aan?</h1>
      <p className="mb-6 mt-2 text-ink/70">Kies je diensten en geef een richtprijs. Je kunt dit later per aanbod verder uitwerken.</p>
      <ServicesForm initial={initial} />
    </>
  );
}
