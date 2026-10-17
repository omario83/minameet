import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { completeSetup } from "@/lib/setup-actions";

export default async function SetupWelcomePage() {
  const profile = await requireRole("vendor");
  const firstName = profile.full_name?.split(" ")[0];

  return (
    <>
      <h1 className="font-display text-3xl font-bold">Welkom{firstName ? `, ${firstName}` : ""}!</h1>
      <p className="mt-3 text-ink/70">
        Laten we je account samen instellen: je diensten en prijzen, je openingstijden en agenda, je bedrijfsgegevens en foto&apos;s. Alles is optioneel en later aan te passen.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href="/leverancier/start/diensten" className="inline-flex h-12 items-center rounded-full bg-brand px-8 font-semibold text-white hover:brightness-110">
          Aan de slag
        </Link>
        <form action={completeSetup}>
          <button className="text-sm font-semibold text-brand underline">Overslaan, ik doe dit later</button>
        </form>
      </div>
    </>
  );
}
