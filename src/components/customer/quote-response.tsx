"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/form-ui";
import { respondToQuote } from "@/lib/customer-actions";

export function QuoteResponse({ quoteId }: { quoteId: string }) {
  const [state, action, pending] = useActionState(respondToQuote, undefined);

  return (
    <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="quote_id" value={quoteId} />
      <button name="decision" value="accept" disabled={pending} className="h-11 rounded-full bg-st-won px-6 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        Offerte accepteren
      </button>
      <button name="decision" value="decline" disabled={pending} className="h-11 rounded-full border border-ink/15 px-6 font-semibold hover:border-st-lost hover:text-st-lost disabled:opacity-60">
        Afwijzen
      </button>
      <FormStatus state={state} />
    </form>
  );
}
