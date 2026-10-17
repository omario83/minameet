"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Field, FormStatus, inputClass } from "@/components/form-ui";
import { CATEGORIES } from "@/lib/categories";
import { PRICE_MODELS, type CategoryDb } from "@/lib/listing-fields";
import { saveSetupServices } from "@/lib/setup-actions";

export type ServiceDefault = { selected: boolean; price_model: string; price: string };

export function ServicesForm({ initial }: { initial: Record<CategoryDb, ServiceDefault> }) {
  const [state, action, pending] = useActionState(saveSetupServices, undefined);
  const [services, setServices] = useState(initial);
  const errors = state?.fieldErrors ?? {};

  const update = (category: CategoryDb, patch: Partial<ServiceDefault>) =>
    setServices((prev) => ({ ...prev, [category]: { ...prev[category], ...patch } }));

  return (
    <form action={action} className="space-y-5">
      <ul className="space-y-3">
        {CATEGORIES.map(({ db, label, blurb, icon: Icon }) => {
          const service = services[db];
          return (
            <li key={db} className={`rounded-2xl border-2 bg-white p-4 ${service.selected ? "border-brand" : "border-transparent shadow-sm"}`}>
              <label className="flex cursor-pointer items-center gap-4">
                <input
                  type="checkbox"
                  name="category"
                  value={db}
                  checked={service.selected}
                  onChange={(e) => update(db, { selected: e.target.checked })}
                  className="peer sr-only"
                />
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${service.selected ? "bg-brand text-white" : "bg-brand-soft text-brand"} peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2`}>
                  {service.selected ? <Check aria-hidden className="size-5" /> : <Icon aria-hidden className="size-5" />}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-ink/60">{blurb}</span>
                </span>
              </label>

              {service.selected && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field id={`price_model_${db}`} label="Zo reken je de prijs" error={errors[`price_model_${db}`]}>
                    <select
                      id={`price_model_${db}`}
                      name={`price_model_${db}`}
                      value={service.price_model}
                      onChange={(e) => update(db, { price_model: e.target.value })}
                      className={inputClass}
                    >
                      {PRICE_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id={`price_${db}`} label="Prijs in € (optioneel)" error={errors[`price_${db}`]}>
                    <input
                      id={`price_${db}`}
                      name={`price_${db}`}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="bijv. 1500"
                      value={service.price}
                      onChange={(e) => update(db, { price: e.target.value })}
                      aria-invalid={errors[`price_${db}`] ? true : undefined}
                      aria-describedby={errors[`price_${db}`] ? `price_${db}-error` : undefined}
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {errors.category && (
        <p role="alert" className="text-sm font-medium text-st-lost">
          {errors.category}
        </p>
      )}
      <FormStatus state={state?.fieldErrors ? undefined : state} />

      <div className="flex flex-wrap items-center gap-4">
        <button disabled={pending} className="h-12 rounded-full bg-brand px-8 font-semibold text-white hover:brightness-110 disabled:opacity-60">
          {pending ? "Bezig…" : "Opslaan en verder"}
        </button>
        <Link href="/leverancier/start/kalender" className="text-sm font-semibold text-brand underline">
          Overslaan
        </Link>
      </div>
    </form>
  );
}
