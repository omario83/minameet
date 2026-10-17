import Link from "next/link";
import { updateVendorAdmin } from "@/lib/admin-actions";
import { eur, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-st-expired",
  pending: "bg-st-todo",
  approved: "bg-st-won",
  rejected: "bg-st-lost",
  suspended: "bg-st-lost",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Aanmelding bezig",
  pending: "Wacht op beoordeling",
  rejected: "Afgekeurd",
};

export default async function AdminPage() {
  const supabase = await createClient();
  const [{ data: vendors }, { data: bookings }] = await Promise.all([
    supabase.from("vendors").select("id, company_name, city, status, commission_pct, created_at, submitted_at").order("created_at", { ascending: false }),
    supabase.from("bookings").select("id, date, total_cents, commission_pct, commission_cents, vendors(company_name)").order("created_at", { ascending: false }).limit(50),
  ]);

  const totalCommission = (bookings ?? []).reduce((sum, b) => sum + b.commission_cents, 0);
  const totalVolume = (bookings ?? []).reduce((sum, b) => sum + b.total_cents, 0);

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Beheer</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Boekingsvolume" value={eur(totalVolume)} />
        <Stat label="Commissie" value={eur(totalCommission)} />
        <Stat label="Wachten op goedkeuring" value={String((vendors ?? []).filter((v) => v.status === "pending").length)} />
      </div>

      <h2 className="mb-3 mt-10 font-display text-xl font-bold">Leveranciers</h2>
      <ul className="space-y-3">
        {[...(vendors ?? [])]
          // Wachtende aanmeldingen eerst, de langst wachtende bovenaan.
          .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || (a.status === "pending" ? (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "") : 0))
          .map((v) => (
          <li key={v.id}>
            <form action={updateVendorAdmin} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
              <input type="hidden" name="vendor_id" value={v.id} />
              <span className={`size-3 rounded-full ${STATUS_COLOR[v.status]}`} />
              <div className="min-w-48 flex-1">
                <p className="font-semibold">{v.company_name}</p>
                <p className="text-xs text-ink/50">{v.city ?? "Plaats onbekend"} · {v.status === "pending" && v.submitted_at ? `ingestuurd ${formatDate(v.submitted_at)}` : `aangemeld ${formatDate(v.created_at)}`}</p>
              </div>
              {v.status === "approved" || v.status === "suspended" ? (
                <select name="status" defaultValue={v.status} className="h-10 rounded-xl border border-ink/15 bg-white px-3 text-sm">
                  <option value="approved">Goedgekeurd</option>
                  <option value="suspended">Geblokkeerd</option>
                </select>
              ) : (
                <span className="text-sm text-ink/60">{STATUS_LABEL[v.status]}</span>
              )}
              <Link href={`/admin/partners/${v.id}`} className="text-sm font-semibold text-brand underline">
                {v.status === "pending" ? "Beoordelen" : "Bekijken"}
              </Link>
              <label className="flex items-center gap-2 text-sm">
                Commissie %
                <input name="commission_pct" type="number" min="0" max="50" step="0.5" defaultValue={v.commission_pct} className="h-10 w-20 rounded-xl border border-ink/15 px-3" />
              </label>
              <button className="h-10 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:brightness-110">Opslaan</button>
            </form>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 mt-10 font-display text-xl font-bold">Boekingen</h2>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase text-ink/40">
            <tr><th className="p-3">Leverancier</th><th className="p-3">Datum</th><th className="p-3">Totaal</th><th className="p-3">Commissie</th></tr>
          </thead>
          <tbody>
            {bookings?.map((b) => (
              <tr key={b.id} className="border-b border-ink/5">
                <td className="p-3">{(b.vendors as unknown as { company_name: string })?.company_name}</td>
                <td className="p-3">{formatDate(b.date)}</td>
                <td className="p-3">{eur(b.total_cents)}</td>
                <td className="p-3">{eur(b.commission_cents)} <span className="text-ink/40">({b.commission_pct}%)</span></td>
              </tr>
            ))}
            {!bookings?.length && <tr><td colSpan={4} className="p-4 text-ink/50">Nog geen boekingen.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="font-display text-3xl font-extrabold">{value}</p>
      <p className="text-sm text-ink/60">{label}</p>
    </div>
  );
}
