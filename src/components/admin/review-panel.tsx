"use client";

import { useActionState } from "react";
import { FormStatus, inputClass } from "@/components/form-ui";
import { approveVendor, rejectVendor } from "@/lib/admin-actions";

/**
 * Blijft ook na de beoordeling gemount, zodat de uitkomst (en een waarschuwing als de mail niet is verstuurd)
 * zichtbaar blijft terwijl de pagina de nieuwe status toont.
 */
export function ReviewPanel({ vendorId, pending }: { vendorId: string; pending: boolean }) {
  const [approveState, approve, approving] = useActionState(approveVendor, undefined);
  const [rejectState, reject, rejecting] = useActionState(rejectVendor, undefined);
  const busy = approving || rejecting;
  const outcome = approveState ?? rejectState;

  if (!pending && !outcome) return null;

  return (
    <div className="space-y-4">
      {outcome && !pending && (
        <div
          role={outcome.error ? "alert" : "status"}
          className={`rounded-2xl px-5 py-4 text-sm font-medium ${outcome.error ? "bg-st-lost/10 text-st-lost" : "bg-st-won/10 text-st-won"}`}
        >
          {outcome.error ?? outcome.message}
        </div>
      )}

      {pending && (
        <div className="grid gap-4 md:grid-cols-2">
          <form action={approve} className="space-y-3 rounded-3xl bg-white p-6 shadow-sm">
            <input type="hidden" name="vendor_id" value={vendorId} />
            <h2 className="font-display text-xl font-bold">Goedkeuren</h2>
            <p className="text-sm text-ink/60">De partner wordt goedgekeurd, al het aanbod wordt zichtbaar voor klanten en de partner krijgt een e-mail.</p>
            <FormStatus state={approveState} />
            <button disabled={busy} aria-busy={approving} className="h-11 rounded-full bg-st-won px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
              {approving ? "Bezig…" : "Goedkeuren"}
            </button>
          </form>

          <form action={reject} className="space-y-3 rounded-3xl bg-white p-6 shadow-sm">
            <input type="hidden" name="vendor_id" value={vendorId} />
            <h2 className="font-display text-xl font-bold">Afkeuren</h2>
            <label htmlFor="reason" className="block text-sm font-medium">
              Reden (wordt gemaild aan de partner)
            </label>
            <textarea id="reason" name="reason" required minLength={5} maxLength={1000} rows={3} className={`${inputClass} h-auto py-3`} />
            <FormStatus state={rejectState} />
            <button disabled={busy} aria-busy={rejecting} className="h-11 rounded-full bg-st-lost px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
              {rejecting ? "Bezig…" : "Afkeuren"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
