"use client";

import { useActionState, useEffect, useState } from "react";
import { Turnstile } from "@/components/auth/turnstile";
import { Field, inputClass } from "@/components/form-ui";
import { resendConfirmation } from "@/lib/auth-actions";

/** `askEmail`: alleen als er geen ondertekend adres bekend is, vraagt het formulier om het e-mailadres. */
export function ResendConfirmation({ initialSecondsLeft, askEmail = false }: { initialSecondsLeft: number; askEmail?: boolean }) {
  const [state, action, pending] = useActionState(resendConfirmation, undefined);
  const [secondsLeft, setSecondsLeft] = useState(initialSecondsLeft);

  // Een nieuw resultaat van de server bepaalt de wachttijd.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.retryAfter !== undefined) setSecondsLeft(state.retryAfter);
  }

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const waiting = secondsLeft > 0;

  return (
    <form action={action} className="space-y-3">
      {askEmail && (
        <Field id="email" label="E-mailadres">
          <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
      )}
      <Turnstile resetSignal={state} />
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-st-lost">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" className="text-sm font-medium text-st-won">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || waiting}
        aria-busy={pending}
        className="h-12 w-full rounded-full bg-brand font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Bezig…" : waiting ? `Mail opnieuw versturen (${secondsLeft} s)` : "Mail opnieuw versturen"}
      </button>
    </form>
  );
}
