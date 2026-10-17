"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Field, FormStatus, inputClass } from "@/components/form-ui";
import { lookupAddress } from "@/lib/address-actions";
import { fieldErrors } from "@/lib/schemas/errors";
import { houseNumberSchema, postalCodeSchema, formatPhone, vendorDetailsSchema } from "@/lib/schemas/vendor-details";
import { saveBusinessDetails } from "@/lib/vendor-actions";

export type DetailsDefaults = {
  kvk?: string;
  vat_number?: string | null;
  street?: string;
  house_number?: number;
  house_number_addition?: string | null;
  postal_code?: string;
  city?: string;
  phone?: string;
  website?: string | null;
  contact_email?: string;
};

type Lookup = "idle" | "busy" | "found" | "notfound";

// Volgorde van de velden op het scherm, voor de focus bij een fout.
const FIELD_ORDER = [
  "kvk",
  "vat_number",
  "postal_code",
  "house_number",
  "house_number_addition",
  "street",
  "city",
  "phone",
  "contact_email",
  "website",
];

function focusFirstError(errors: Record<string, string>) {
  const first = FIELD_ORDER.find((key) => errors[key]);
  if (first) document.getElementById(first)?.focus();
}

const LOOKUP_TEXT: Record<Lookup, string> = {
  idle: "",
  busy: "Adres opzoeken…",
  found: "Straat en plaats zijn ingevuld. Je kunt ze aanpassen.",
  notfound: "Adres niet gevonden. Vul straat en plaats zelf in.",
};

export function DetailsForm({ defaults = {}, onboarding = false, setup = false }: { defaults?: DetailsDefaults; onboarding?: boolean; setup?: boolean }) {
  const [state, dispatch, pending] = useActionState(saveBusinessDetails, undefined);
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);
  const [lookup, setLookup] = useState<Lookup>("idle");
  const [values, setValues] = useState({
    kvk: defaults.kvk ?? "",
    vat_number: defaults.vat_number ?? "",
    postal_code: defaults.postal_code ?? "",
    house_number: defaults.house_number != null ? String(defaults.house_number) : "",
    house_number_addition: defaults.house_number_addition ?? "",
    street: defaults.street ?? "",
    city: defaults.city ?? "",
    phone: formatPhone(defaults.phone),
    website: defaults.website ?? "",
    contact_email: defaults.contact_email ?? "",
  });
  type Key = keyof typeof values;

  // Een handmatig ingevulde straat of plaats wordt niet door de opzoeking overschreven.
  const manual = useRef({ street: !!defaults.street, city: !!defaults.city });
  const lastLookup = useRef(defaults.postal_code && defaults.house_number ? `${defaults.postal_code}|${defaults.house_number}` : "");

  // Een serverfout bij een veld verdwijnt zodra de partner dat veld aanpast.
  const [edited, setEdited] = useState<Record<string, boolean>>({});
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setEdited({});
  }
  const serverErrors = Object.fromEntries(Object.entries(state?.fieldErrors ?? {}).filter(([key]) => !edited[key]));
  const errors = clientErrors ?? serverErrors;

  useEffect(() => {
    if (state?.fieldErrors) focusFirstError(state.fieldErrors);
  }, [state]);

  const bind = (key: Key) => ({
    id: key,
    name: key,
    value: values[key],
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
    className: inputClass,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (key === "street" || key === "city") manual.current[key] = value !== "";
      setEdited((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
      setValues((prev) => ({ ...prev, [key]: value }));
    },
  });

  // Straat en plaats ophalen zodra postcode en huisnummer kloppen, 400 ms na de laatste toetsaanslag.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const postcode = postalCodeSchema.safeParse(values.postal_code);
      const number = houseNumberSchema.safeParse(values.house_number);
      if (!postcode.success || !number.success) return;

      const key = `${postcode.data}|${number.data}`;
      if (key === lastLookup.current) return;
      lastLookup.current = key;

      setLookup("busy");
      const result = await lookupAddress(postcode.data, number.data);
      if (lastLookup.current !== key) return;

      if (!result.found) return setLookup("notfound");
      setValues((prev) => ({
        ...prev,
        street: manual.current.street ? prev.street : result.street,
        city: manual.current.city ? prev.city : result.city,
      }));
      setLookup("found");
    }, 400);
    return () => clearTimeout(timer);
  }, [values.postal_code, values.house_number]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // Hetzelfde schema als op de server, zodat fouten direct zichtbaar zijn.
    const parsed = vendorDetailsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      setClientErrors(found);
      focusFirstError(found);
      return;
    }

    setClientErrors(null);
    startTransition(() => dispatch(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-3xl bg-white p-6 shadow-sm">
      {(onboarding || setup) && <input type="hidden" name="continue" value={setup ? "setup" : "1"} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="kvk" label="KvK-nummer" hint="8 cijfers" error={errors.kvk}>
          <input {...bind("kvk")} inputMode="numeric" autoComplete="off" />
        </Field>
        <Field id="vat_number" label="Btw-nummer (optioneel)" hint="Bijvoorbeeld NL123456789B01" error={errors.vat_number}>
          <input {...bind("vat_number")} autoComplete="off" />
        </Field>
      </div>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-lg font-bold">Vestigingsadres</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="postal_code" label="Postcode" error={errors.postal_code}>
            <input {...bind("postal_code")} autoComplete="postal-code" />
          </Field>
          <Field id="house_number" label="Huisnummer" error={errors.house_number}>
            <input {...bind("house_number")} inputMode="numeric" autoComplete="off" />
          </Field>
          <Field id="house_number_addition" label="Toevoeging" error={errors.house_number_addition}>
            <input {...bind("house_number_addition")} autoComplete="off" />
          </Field>
        </div>
        <p aria-live="polite" className="min-h-5 text-xs text-ink/50">
          {LOOKUP_TEXT[lookup]}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="street" label="Straat" error={errors.street}>
            <input {...bind("street")} autoComplete="address-line1" />
          </Field>
          <Field id="city" label="Plaats" error={errors.city}>
            <input {...bind("city")} autoComplete="address-level2" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-lg font-bold">Contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="phone" label="Telefoonnummer" hint="Bijvoorbeeld 06 12345678 of +32 470 12 34 56" error={errors.phone}>
            <input {...bind("phone")} type="tel" autoComplete="tel" />
          </Field>
          <Field id="contact_email" label="Contact e-mailadres" error={errors.contact_email}>
            <input {...bind("contact_email")} type="email" autoComplete="email" />
          </Field>
        </div>
        <Field id="website" label="Website (optioneel)" error={errors.website}>
          <input {...bind("website")} inputMode="url" autoComplete="url" />
        </Field>
      </fieldset>

      <FormStatus state={state} />
      <button disabled={pending} className="h-12 rounded-full bg-brand px-8 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? "Bezig…" : onboarding || setup ? "Opslaan en verder" : "Opslaan"}
      </button>
    </form>
  );
}
