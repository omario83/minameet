"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Turnstile } from "@/components/auth/turnstile";
import { Field, FormStatus, inputClass } from "@/components/form-ui";
import { signUpVendor } from "@/lib/auth-actions";
import { CATEGORIES } from "@/lib/categories";
import { passwordStrength } from "@/lib/password-strength";
import { fieldErrors } from "@/lib/schemas/errors";
import { PASSWORD_MIN, vendorSignUpSchema } from "@/lib/schemas/vendor-signup";

type Key = "full_name" | "company_name" | "category" | "email" | "password" | "terms";
type TextKey = Exclude<Key, "terms">;

const ORDER: Key[] = ["full_name", "company_name", "category", "email", "password", "terms"];
const STRENGTH_BAR = ["bg-st-expired", "bg-st-lost", "bg-st-todo", "bg-st-option", "bg-st-won"];
const HINTS: Partial<Record<Key, string>> = { password: `Minimaal ${PASSWORD_MIN} tekens` };

export function VendorSignUpForm() {
  const [state, dispatch, pending] = useActionState(signUpVendor, undefined);
  const [values, setValues] = useState<Record<TextKey, string>>({
    full_name: "",
    company_name: "",
    category: "",
    email: "",
    password: "",
  });
  const [terms, setTerms] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const inFlight = useRef(false);

  // Een nieuw resultaat betekent dat de vorige verzending klaar is.
  useEffect(() => {
    inFlight.current = false;
  }, [state]);

  // Dezelfde regels als op de server. Een fout verschijnt na het verlaten van het veld en wordt daarna live bijgewerkt.
  const result = vendorSignUpSchema.safeParse({ ...values, terms: terms ? "on" : undefined });
  const errors = result.success ? {} : fieldErrors(result.error);
  const visible = (key: Key): string | undefined => (touched[key] ? errors[key] : undefined);
  const touch = (key: Key) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

  function describedBy(key: Key) {
    const ids = [visible(key) ? `${key}-error` : HINTS[key] ? `${key}-hint` : null, key === "password" && values.password ? "password-strength" : null];
    return ids.filter(Boolean).join(" ") || undefined;
  }

  const control = (key: TextKey) => ({
    id: key,
    name: key,
    value: values[key],
    className: inputClass,
    "aria-invalid": visible(key) ? true : undefined,
    "aria-describedby": describedBy(key),
    onBlur: () => touch(key),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setValues((prev) => ({ ...prev, [key]: value }));
    },
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || inFlight.current) return;

    if (!result.success) {
      setTouched(Object.fromEntries(ORDER.map((key) => [key, true])));
      const first = ORDER.find((key) => errors[key]);
      if (first) document.getElementById(first)?.focus();
      return;
    }

    inFlight.current = true;
    const formData = new FormData(event.currentTarget);
    // Het wachtwoord blijft niet in het formulier staan, ook niet bij een fout.
    setValues((prev) => ({ ...prev, password: "" }));
    startTransition(() => dispatch(formData));
  }

  const strength = passwordStrength(values.password, PASSWORD_MIN);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="full_name" label="Contactpersoon" error={visible("full_name")}>
        <input {...control("full_name")} autoComplete="name" />
      </Field>

      <Field id="company_name" label="Bedrijfsnaam" error={visible("company_name")}>
        <input {...control("company_name")} autoComplete="organization" />
      </Field>

      <Field id="category" label="Categorie" hint="Je kunt later meer aanbod toevoegen." error={visible("category")}>
        <select {...control("category")}>
          <option value="" disabled>
            Kies een categorie
          </option>
          {CATEGORIES.map((c) => (
            <option key={c.db} value={c.db}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <Field id="email" label="Zakelijk e-mailadres" error={visible("email")}>
        <input {...control("email")} type="email" autoComplete="email" />
      </Field>

      <Field id="password" label="Wachtwoord" hint={HINTS.password} error={visible("password")}>
        <div className="relative">
          <input {...control("password")} type={showPassword ? "text" : "password"} autoComplete="new-password" className={`${inputClass} pr-12`} />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Verberg wachtwoord" : "Toon wachtwoord"}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-ink/60 hover:text-brand"
          >
            {showPassword ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          </button>
        </div>
        {values.password && (
          <div id="password-strength" aria-live="polite" className="mt-2">
            <div aria-hidden className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength.score ? STRENGTH_BAR[strength.score] : "bg-ink/10"}`} />
              ))}
            </div>
            <p className="mt-1 text-xs text-ink/60">Sterkte: {strength.label}</p>
          </div>
        )}
      </Field>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input
            id="terms"
            name="terms"
            type="checkbox"
            checked={terms}
            onChange={(e) => {
              setTerms(e.target.checked);
              touch("terms");
            }}
            onBlur={() => touch("terms")}
            aria-invalid={visible("terms") ? true : undefined}
            aria-describedby={visible("terms") ? "terms-error" : undefined}
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
        {visible("terms") && (
          <p id="terms-error" role="alert" className="mt-1 text-xs font-medium text-st-lost">
            {visible("terms")}
          </p>
        )}
      </div>

      <Turnstile resetSignal={state} />
      <FormStatus state={state} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="h-12 w-full rounded-full bg-brand font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Bezig…" : "Account aanmaken"}
      </button>
    </form>
  );
}
