"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/form-ui";
import { deleteListing } from "@/lib/vendor-actions";

export function DeleteListing({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState(deleteListing, undefined);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Weet je zeker dat je dit aanbod wilt verwijderen? Dit kan niet ongedaan worden gemaakt.")) e.preventDefault();
      }}
      className="rounded-3xl border border-st-lost/30 bg-white p-6"
    >
      <input type="hidden" name="listing_id" value={listingId} />
      <h2 className="font-display text-lg font-bold">Aanbod verwijderen</h2>
      <p className="mt-1 text-sm text-stone">Wil je het alleen tijdelijk verbergen? Zet dan &ldquo;Zichtbaar voor klanten&rdquo; uit.</p>
      <div className="mt-3">
        <FormStatus state={state} />
      </div>
      <button disabled={pending} className="mt-3 h-10 rounded-full border border-st-lost px-6 text-sm font-semibold text-st-lost hover:bg-st-lost hover:text-white disabled:opacity-60">
        Verwijderen
      </button>
    </form>
  );
}
