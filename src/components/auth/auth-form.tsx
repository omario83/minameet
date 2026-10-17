"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { ResendConfirmation } from "@/components/auth/resend-confirmation";
import { Turnstile } from "@/components/auth/turnstile";
import type { FormState } from "@/lib/auth-actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string };

// De server controleert het pad nog eens (safeNext); hier wordt het alleen doorgegeven.
function NextField() {
  const next = useSearchParams().get("next") ?? "";
  return <input type="hidden" name="next" value={next} />;
}

export function AuthForm({
  action,
  fields,
  submitLabel,
  accent,
  captcha = true,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields: Field[];
  submitLabel: string;
  accent: string;
  captcha?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <>
      <form action={formAction} className="space-y-4">
        <Suspense fallback={null}>
          <NextField />
        </Suspense>
        {fields.map(({ name, label, type = "text", autoComplete }) => (
          <div key={name}>
            <label htmlFor={name} className="mb-1 block text-sm font-medium">
              {label}
            </label>
            <input
              id={name}
              name={name}
              type={type}
              autoComplete={autoComplete}
              required
              className="h-12 w-full rounded-xl border border-ink/15 bg-white px-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        ))}
        {captcha && <Turnstile resetSignal={state} />}
        {state?.error && <p role="alert" className="text-sm font-medium text-st-lost">{state.error}</p>}
        {state?.message && <p role="status" className="text-sm font-medium text-st-won">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className={`h-12 w-full rounded-full font-semibold text-white transition hover:brightness-110 disabled:opacity-60 ${accent}`}
        >
          {pending ? "Bezig…" : submitLabel}
        </button>
      </form>

      {/* Het adres staat in een ondertekende cookie die de inlogactie zette. */}
      {state?.needsConfirmation && (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <ResendConfirmation initialSecondsLeft={0} />
        </div>
      )}
    </>
  );
}
