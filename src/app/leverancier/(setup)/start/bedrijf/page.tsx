import Link from "next/link";
import { DetailsForm } from "@/components/vendor/details-form";
import { getVendor } from "@/lib/vendor";

export default async function SetupBusinessPage() {
  const { supabase, vendor } = await getVendor();
  const [{ data: details }, { data: userData }] = await Promise.all([
    supabase
      .from("vendor_details")
      .select("kvk, vat_number, street, house_number, house_number_addition, postal_code, city, phone, website, contact_email")
      .eq("vendor_id", vendor.id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Bedrijfsgegevens</h1>
      <p className="mb-6 mt-2 text-ink/70">Optioneel nu, maar nodig om je aanmelding in te sturen.</p>
      <DetailsForm defaults={details ?? { contact_email: userData.user?.email ?? "" }} setup />
      <p className="mt-5">
        <Link href="/leverancier/start/fotos" className="text-sm font-semibold text-brand underline">
          Overslaan
        </Link>
      </p>
    </>
  );
}
