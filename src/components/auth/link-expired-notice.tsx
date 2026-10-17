"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function Notice({ vendor }: { vendor: boolean }) {
  if (useSearchParams().get("melding") !== "link-verlopen") return null;

  return (
    <div role="status" className="mb-5 rounded-2xl bg-brand-soft p-4 text-sm">
      <p className="font-semibold">Deze link werkt niet (meer)</p>
      <p className="mt-1 text-ink/70">
        Een link uit een e-mail is maar kort geldig, werkt één keer en moet in dezelfde browser worden geopend als waarin je je aanmeldde. Is je e-mailadres al bevestigd, dan kun je
        gewoon inloggen.
        {vendor ? " Zo niet, vraag dan een nieuwe bevestigingsmail aan." : " Lukt dat niet, maak dan opnieuw een account aan."}
      </p>
      {vendor && (
        <Link
          href="/leverancier/registreren/controleer-mail"
          className="mt-3 inline-flex h-11 items-center rounded-full bg-brand px-6 font-semibold text-white hover:brightness-110"
        >
          Nieuwe bevestigingsmail
        </Link>
      )}
    </div>
  );
}

/** Uitleg na een mislukte e-maillink (`?melding=link-verlopen`). */
export function LinkExpiredNotice({ vendor = false }: { vendor?: boolean }) {
  return (
    <Suspense fallback={null}>
      <Notice vendor={vendor} />
    </Suspense>
  );
}
