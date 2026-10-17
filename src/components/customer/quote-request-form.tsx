"use client";

import { useActionState } from "react";
import { Field, FormStatus, inputClass } from "@/components/form-ui";
import { createQuoteRequests } from "@/lib/customer-actions";

export function QuoteRequestForm({
  listings,
  defaults,
  today,
}: {
  listings: { id: string; title: string; vendor: string }[];
  defaults: { date?: string; guests?: string; name?: string };
  today: string;
}) {
  const [state, action, pending] = useActionState(createQuoteRequests, undefined);

  return (
    <form action={action} className="space-y-5 rounded-3xl bg-white p-6 shadow-sm">
      {listings.map((l) => (
        <input key={l.id} type="hidden" name="listing_id" value={l.id} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="event_type" label="Soort feest">
          <input id="event_type" name="event_type" placeholder="Bijvoorbeeld: Turkse bruiloft" className={inputClass} />
        </Field>
        <Field id="event_date" label="Datum">
          <input id="event_date" name="event_date" type="date" min={today} required defaultValue={defaults.date} className={inputClass} />
        </Field>
        <Field id="guest_count" label="Aantal gasten">
          <input id="guest_count" name="guest_count" type="number" min="1" defaultValue={defaults.guests} className={inputClass} />
        </Field>
        <Field id="budget" label="Budget (€, optioneel)">
          <input id="budget" name="budget" type="number" min="0" step="50" className={inputClass} />
        </Field>
        <Field id="contact_name" label="Contactnaam">
          <input id="contact_name" name="contact_name" required defaultValue={defaults.name} className={inputClass} />
        </Field>
        <Field id="contact_phone" label="Telefoon (optioneel)">
          <input id="contact_phone" name="contact_phone" type="tel" className={inputClass} />
        </Field>
      </div>
      <Field id="message" label="Bericht aan de aanbieder(s)">
        <textarea id="message" name="message" rows={4} className={`${inputClass} h-auto py-3`} />
      </Field>

      <p className="text-xs text-ink/50">
        Je naam, telefoonnummer en bericht worden gedeeld met de gekozen aanbieder(s) zodat zij een offerte kunnen maken.
      </p>
      <FormStatus state={state} />
      <button disabled={pending} className="h-12 rounded-full bg-coral px-8 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? "Bezig…" : `Offerte aanvragen bij ${listings.length} aanbieder${listings.length > 1 ? "s" : ""}`}
      </button>
    </form>
  );
}
