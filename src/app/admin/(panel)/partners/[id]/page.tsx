import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ReviewPanel } from "@/components/admin/review-panel";
import { CATEGORIES } from "@/lib/categories";
import { eur, formatDate } from "@/lib/format";
import { PRICE_MODELS } from "@/lib/listing-fields";
import { photoUrl } from "@/lib/photos";
import { formatPhone } from "@/lib/schemas/vendor-details";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  draft: "Aanmelding bezig",
  pending: "Wacht op beoordeling",
  approved: "Goedgekeurd",
  rejected: "Afgekeurd",
  suspended: "Geblokkeerd",
};

export default async function AdminPartnerPage({ params }: PageProps<"/admin/partners/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, company_name, status, primary_category, description, city, region, commission_pct, created_at, submitted_at, reviewed_at, rejection_reason, terms_version, terms_accepted_at")
    .eq("id", id)
    .single();
  if (!vendor) notFound();

  const [{ data: details }, { data: listings }] = await Promise.all([
    supabase.from("vendor_details").select("*").eq("vendor_id", id).maybeSingle(),
    supabase
      .from("listings")
      .select("id, category, title, description, price_model, base_price_cents, min_guests, max_guests, photos")
      .eq("vendor_id", id)
      .order("created_at"),
  ]);

  const category = CATEGORIES.find((c) => c.db === vendor.primary_category)?.label;

  return (
    <>
      <Link href="/admin" className="text-sm font-semibold text-brand">
        ← Terug naar beheer
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold">{vendor.company_name}</h1>
      <p className="text-sm text-ink/60">
        {STATUS_LABEL[vendor.status]} · {category ?? "Categorie onbekend"} · ingestuurd {formatDate(vendor.submitted_at)}
      </p>
      {vendor.rejection_reason && <p className="mt-3 rounded-2xl bg-st-lost/10 px-5 py-3 text-sm">Reden van afkeuring: {vendor.rejection_reason}</p>}

      <div className="mt-6">
        <ReviewPanel vendorId={vendor.id} pending={vendor.status === "pending"} />
      </div>

      <h2 className="mb-3 mt-10 font-display text-xl font-bold">Bedrijfsgegevens</h2>
      {details ? (
        <dl className="grid gap-3 rounded-3xl bg-white p-6 text-sm shadow-sm sm:grid-cols-2">
          <Item label="KvK-nummer" value={details.kvk} />
          <Item label="Btw-nummer" value={details.vat_number} />
          <Item
            label="Adres"
            value={`${details.street} ${details.house_number}${details.house_number_addition ? ` ${details.house_number_addition}` : ""}, ${details.postal_code} ${details.city}`}
          />
          <Item label="Telefoon" value={formatPhone(details.phone)} />
          <Item label="Contact e-mail" value={details.contact_email} />
          <Item label="Commissie" value={`${vendor.commission_pct}%`} />
          <div>
            <dt className="text-ink/50">Website</dt>
            <dd className="font-medium">
              {details.website ? (
                <a href={details.website} target="_blank" rel="noopener noreferrer" className="text-brand underline">
                  {details.website}
                </a>
              ) : (
                "-"
              )}
            </dd>
          </div>
          <Item label="Voorwaarden geaccepteerd" value={vendor.terms_version ? `versie ${vendor.terms_version}, ${formatDate(vendor.terms_accepted_at)}` : null} />
        </dl>
      ) : (
        <p className="rounded-3xl bg-white p-6 text-sm text-ink/60">Nog geen bedrijfsgegevens ingevuld.</p>
      )}

      <h2 className="mb-3 mt-10 font-display text-xl font-bold">Aanbod</h2>
      <ul className="space-y-4">
        {listings?.map((l) => (
          <li key={l.id} className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="font-display text-lg font-bold">{l.title}</p>
            <p className="text-sm text-ink/60">
              {CATEGORIES.find((c) => c.db === l.category)?.label} · {eur(l.base_price_cents)} ({PRICE_MODELS.find((m) => m.value === l.price_model)?.label}) · {l.min_guests ?? "?"} tot {l.max_guests ?? "?"} gasten
            </p>
            {l.description && <p className="mt-2 text-sm">{l.description}</p>}
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {(l.photos as string[]).map((path, i) => (
                <li key={path} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sand">
                  <Image src={photoUrl(path)} alt={`${l.title}, foto ${i + 1}`} fill sizes="160px" className="object-cover" />
                </li>
              ))}
            </ul>
          </li>
        ))}
        {!listings?.length && <li className="rounded-3xl bg-white p-6 text-sm text-ink/60">Nog geen aanbod.</li>}
      </ul>
    </>
  );
}

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-ink/50">{label}</dt>
      <dd className="font-medium">{value ?? "-"}</dd>
    </div>
  );
}
