"use client";

import { useActionState } from "react";
import { Field, FormStatus, inputClass } from "@/components/form-ui";
import type { FormState } from "@/lib/auth-actions";
import { FIELDS, PRICE_MODELS, type CategoryDb } from "@/lib/listing-fields";

export type ListingDefaults = {
  id?: string;
  title?: string;
  description?: string | null;
  price_model?: string;
  base_price_cents?: number | null;
  min_guests?: number | null;
  max_guests?: number | null;
  is_published?: boolean;
  attributes?: Record<string, unknown>;
};

export function ListingForm({
  action,
  category,
  defaults = {},
  submitLabel,
  flow,
  hidePublish = false,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  category: CategoryDb;
  defaults?: ListingDefaults;
  submitLabel: string;
  /** `onboarding`: na opslaan terug naar de aanmeldpagina in plaats van het aanbodscherm. */
  flow?: "onboarding";
  /** Publiceren gebeurt tijdens de aanmelding pas bij goedkeuring. */
  hidePublish?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const attrs = defaults.attributes ?? {};

  return (
    <form action={formAction} className="space-y-6 rounded-3xl bg-white p-6 shadow-sm">
      <input type="hidden" name="category" value={category} />
      {flow && <input type="hidden" name="flow" value={flow} />}
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <Field id="title" label="Titel">
        <input id="title" name="title" required defaultValue={defaults.title} className={inputClass} />
      </Field>
      <Field id="description" label="Omschrijving">
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaults.description ?? ""}
          className={`${inputClass} h-auto py-3`}
        />
      </Field>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-display text-lg font-bold">Prijs en gasten</legend>
        <Field id="price_model" label="Prijsmodel">
          <select id="price_model" name="price_model" defaultValue={defaults.price_model ?? "fixed"} className={inputClass}>
            {PRICE_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="price" label="Prijs (€)">
          <input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaults.base_price_cents != null ? defaults.base_price_cents / 100 : ""}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="min_guests" label="Min. gasten">
            <input id="min_guests" name="min_guests" type="number" min="0" defaultValue={defaults.min_guests ?? ""} className={inputClass} />
          </Field>
          <Field id="max_guests" label="Max. gasten">
            <input id="max_guests" name="max_guests" type="number" min="0" defaultValue={defaults.max_guests ?? ""} className={inputClass} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-lg font-bold">Specificaties</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS[category]
            .filter((f) => f.type !== "boolean")
            .map((f) => (
              <Field key={f.key} id={`attr_${f.key}`} label={f.label} hint={f.hint}>
                {f.type === "select" ? (
                  <select id={`attr_${f.key}`} name={`attr_${f.key}`} defaultValue={String(attrs[f.key] ?? "")} className={inputClass}>
                    <option value="">Kies…</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`attr_${f.key}`}
                    name={`attr_${f.key}`}
                    type={f.type === "number" ? "number" : "text"}
                    min={f.type === "number" ? 0 : undefined}
                    defaultValue={attrs[f.key] != null ? String(attrs[f.key]) : ""}
                    className={inputClass}
                  />
                )}
              </Field>
            ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS[category]
            .filter((f) => f.type === "boolean")
            .map((f) => (
              <label key={f.key} className="flex items-center gap-3 rounded-xl border border-ink/10 px-4 py-3">
                <input type="checkbox" name={`attr_${f.key}`} defaultChecked={attrs[f.key] === true} className="size-5 accent-brand" />
                {f.label}
              </label>
            ))}
        </div>
      </fieldset>

      {!hidePublish && (
        <label className="flex items-center gap-3 rounded-xl bg-brand-soft px-4 py-3 font-medium">
          <input type="checkbox" name="is_published" defaultChecked={defaults.is_published} className="size-5 accent-brand" />
          Zichtbaar voor klanten
        </label>
      )}

      <FormStatus state={state} />
      <button disabled={pending} className="h-12 rounded-full bg-brand px-8 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? "Bezig…" : submitLabel}
      </button>
    </form>
  );
}
