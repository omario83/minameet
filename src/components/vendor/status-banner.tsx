import Link from "next/link";
import type { Vendor } from "@/lib/vendor";

/** Meldt de stand van de aanmelding; goedgekeurde partners zien niets. */
export function StatusBanner({ vendor }: { vendor: Pick<Vendor, "status" | "rejection_reason"> }) {
  const base = "mt-4 rounded-2xl px-5 py-4 text-sm font-medium";

  switch (vendor.status) {
    case "approved":
      return null;
    case "pending":
      return (
        <p className={`${base} bg-gold/30`}>
          Je aanmelding wordt beoordeeld. We hebben je gegevens ontvangen en laten je per e-mail weten of je wordt goedgekeurd.
        </p>
      );
    case "rejected":
      return (
        <div className={`${base} bg-st-lost/10`}>
          <p>Je aanmelding is niet goedgekeurd.</p>
          {vendor.rejection_reason && <p className="mt-1 font-normal">Reden: {vendor.rejection_reason}</p>}
          <Link href="/leverancier/aanmelden" className="mt-2 inline-block font-semibold text-brand underline">
            Aanpassen en opnieuw insturen
          </Link>
        </div>
      );
    case "suspended":
      return <p className={`${base} bg-st-lost/10`}>Je account is geblokkeerd. Neem contact op met MinaMeet.</p>;
    default:
      return (
        <p className={`${base} bg-gold/30`}>
          Je aanmelding is nog niet ingestuurd.{" "}
          <Link href="/leverancier/aanmelden" className="font-semibold text-brand underline">
            Verder gaan
          </Link>
        </p>
      );
  }
}
