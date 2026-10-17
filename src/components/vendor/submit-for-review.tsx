"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FormStatus } from "@/components/form-ui";
import { submitForReview } from "@/lib/vendor-actions";

/** `needsTerms`: voor partners zonder vastgelegd akkoord op de voorwaarden. */
export function SubmitForReview({ ready, needsTerms = false }: { ready: boolean; needsTerms?: boolean }) {
  const [state, dispatch, pending] = useActionState(submitForReview, undefined);
  const [terms, setTerms] = useState(false);
  const inFlight = useRef(false);

  // Een nieuw resultaat betekent dat de vorige verzending klaar is.
  useEffect(() => {
    inFlight.current = false;
  }, [state]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || inFlight.current) return;
    inFlight.current = true;
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {needsTerms && (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="terms"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-brand"
          />
          <span>
            Ik ga akkoord met de{" "}
            <Link href="/voorwaarden-partners" target="_blank" rel="noopener" className="font-semibold text-brand underline">
              partnervoorwaarden
            </Link>{" "}
            en het{" "}
            <Link href="/privacy" target="_blank" rel="noopener" className="font-semibold text-brand underline">
              privacybeleid
            </Link>
            .
          </span>
        </label>
      )}
      <FormStatus state={state} />
      <button
        type="submit"
        disabled={!ready || pending || (needsTerms && !terms)}
        aria-busy={pending}
        className="h-12 rounded-full bg-brand px-8 font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Bezig…" : "Aanmelding insturen"}
      </button>
    </form>
  );
}
