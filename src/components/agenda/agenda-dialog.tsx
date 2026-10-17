"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Field, FormStatus, inputClass } from "@/components/form-ui";
import { deleteAgendaItem, saveAgendaItem } from "@/lib/agenda-actions";
import type { AgendaEvent, AgendaListing } from "@/lib/agenda/types";
import { formatTime, toLocal } from "@/lib/agenda/time";
import { formatPriceInput } from "@/lib/agenda/format";
import type { FormState } from "@/lib/auth-actions";
import { parseAgendaItem } from "@/lib/schemas/agenda";

export type DialogState =
  | { mode: "new"; date: string; from: number; to: number; allDay?: boolean }
  | { mode: "edit"; event: AgendaEvent }
  | { mode: "view"; event: AgendaEvent };

type Values = {
  id: string;
  kind: "appointment" | "block";
  title: string;
  customer_name: string;
  listing_id: string;
  status: string;
  note: string;
  price: string;
  all_day: boolean;
  date: string;
  end_date: string;
  start_time: string;
  end_time: string;
};

function initialValues(state: DialogState): Values {
  if (state.mode === "new") {
    return {
      id: "",
      kind: "appointment",
      title: "",
      customer_name: "",
      listing_id: "",
      status: "confirmed",
      note: "",
      price: "",
      all_day: !!state.allDay,
      date: state.date,
      end_date: state.date,
      start_time: formatTime(Math.min(state.from, 23 * 60)),
      end_time: formatTime(Math.min(Math.max(state.to, state.from + 30), 24 * 60)),
    };
  }

  const e = state.event;
  const start = toLocal(e.startsAt);
  const end = toLocal(new Date(new Date(e.endsAt).getTime() - 1));
  return {
    id: e.id,
    kind: e.kind === "block" ? "block" : "appointment",
    title: e.title,
    customer_name: e.customerName ?? "",
    listing_id: e.listingId ?? "",
    status: e.status === "pending" || e.status === "completed" ? e.status : "confirmed",
    note: e.note ?? "",
    price: formatPriceInput(e.priceCents),
    all_day: e.allDay,
    date: start.date,
    end_date: e.allDay ? end.date : start.date,
    start_time: formatTime(start.minutes),
    end_time: formatTime(toLocal(e.endsAt).minutes === 0 ? 24 * 60 : toLocal(e.endsAt).minutes),
  };
}

function ViewOnly({ event, onClose }: { event: AgendaEvent; onClose: () => void }) {
  const start = toLocal(event.startsAt);
  const end = toLocal(event.endsAt);
  const when = event.allDay
    ? "Hele dag"
    : `${formatTime(start.minutes)} - ${formatTime(end.minutes === 0 ? 24 * 60 : end.minutes)}`;
  const sourceLabel: Record<AgendaEvent["source"], string> = {
    item: "Afspraak uit je gekoppelde kalender. Wijzig die in je eigen kalender-app.",
    booking: "Boeking via MinaMeet. Beheer die onder Aanvragen.",
    availability: "Dag met een optie of boeking op je aanbod. Wijzig dit bij je aanbod.",
  };

  return (
    <div className="p-6">
      <h2 className="font-display text-xl font-bold">{event.title}</h2>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex gap-2"><dt className="w-20 text-ink/50">Datum</dt><dd>{start.date}</dd></div>
        <div className="flex gap-2"><dt className="w-20 text-ink/50">Tijd</dt><dd>{when}</dd></div>
        {event.subtitle && <div className="flex gap-2"><dt className="w-20 text-ink/50">Aanbod</dt><dd>{event.subtitle}</dd></div>}
        {event.priceCents != null && <div className="flex gap-2"><dt className="w-20 text-ink/50">Bedrag</dt><dd>€ {formatPriceInput(event.priceCents)}</dd></div>}
      </dl>
      <p className="mt-4 rounded-xl bg-brand-soft px-4 py-3 text-sm">{sourceLabel[event.source]}</p>
      <button type="button" onClick={onClose} className="mt-5 h-11 rounded-full border border-ink/15 px-6 text-sm font-semibold hover:border-brand hover:text-brand">
        Sluiten
      </button>
    </div>
  );
}

function ItemForm({ state, listings, onClose }: { state: Exclude<DialogState, { mode: "view" }>; listings: AgendaListing[]; onClose: () => void }) {
  const [values, setValues] = useState<Values>(() => initialValues(state));
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);

  const [saved, save, saving] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveAgendaItem(prev, formData);
    if (result?.message) onClose();
    return result;
  }, undefined);
  const [removed, remove, removing] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await deleteAgendaItem(prev, formData);
    if (result?.message) onClose();
    return result;
  }, undefined);

  const errors = clientErrors ?? saved?.fieldErrors ?? {};
  const isBlock = values.kind === "block";
  const set = (key: keyof Values, value: string | boolean) => setValues((prev) => ({ ...prev, [key]: value }));

  const field = (key: keyof Values & string) => ({
    id: `agenda-${key}`,
    name: key,
    value: String(values[key]),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `agenda-${key}-error` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(key, e.target.value),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Hetzelfde schema als op de server.
    const parsed = parseAgendaItem(Object.fromEntries(formData));
    if (!parsed.success) {
      setClientErrors(parsed.errors);
      const first = Object.keys(parsed.errors)[0];
      if (first) document.getElementById(`agenda-${first}`)?.focus();
      return;
    }
    setClientErrors(null);
    startTransition(() => save(formData));
  }

  const editing = state.mode === "edit";

  return (
    <div className="p-6">
      <h2 id="agenda-dialog-title" className="font-display text-xl font-bold">
        {editing ? "Afspraak wijzigen" : "Nieuw in je agenda"}
      </h2>

      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
        <input type="hidden" name="id" value={values.id} />
        <input type="hidden" name="kind" value={values.kind} />

        <div role="radiogroup" aria-label="Soort" className="grid grid-cols-2 gap-2 rounded-full bg-sand p-1 text-sm font-semibold">
          {(["appointment", "block"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={values.kind === kind}
              onClick={() => setValues((prev) => ({ ...prev, kind, title: prev.title || (kind === "block" ? "Geblokkeerd" : "") }))}
              className={`h-10 rounded-full ${values.kind === kind ? "bg-white shadow-sm" : "text-ink/60"}`}
            >
              {kind === "appointment" ? "Afspraak" : "Blokkade"}
            </button>
          ))}
        </div>

        <Field id="agenda-title" label="Titel" error={errors.title}>
          <input {...field("title")} className={inputClass} autoComplete="off" />
        </Field>

        {!isBlock && (
          <Field id="agenda-customer_name" label="Klant (optioneel)" error={errors.customer_name}>
            <input {...field("customer_name")} className={inputClass} autoComplete="off" />
          </Field>
        )}

        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="all_day"
            checked={values.all_day}
            onChange={(e) => set("all_day", e.target.checked)}
            className="size-5 accent-brand"
          />
          Hele dag(en)
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="agenda-date" label={values.all_day ? "Van" : "Datum"} error={errors.date}>
            <input {...field("date")} type="date" className={inputClass} />
          </Field>
          {values.all_day ? (
            <Field id="agenda-end_date" label="Tot en met" error={errors.end_date}>
              <input {...field("end_date")} type="date" min={values.date} className={inputClass} />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field id="agenda-start_time" label="Van" error={errors.start_time}>
                <input {...field("start_time")} type="time" step={900} className={inputClass} />
              </Field>
              <Field id="agenda-end_time" label="Tot" error={errors.end_time}>
                <input {...field("end_time")} type="time" step={900} className={inputClass} />
              </Field>
            </div>
          )}
        </div>

        {listings.length > 0 && (
          <Field id="agenda-listing_id" label="Aanbod (optioneel)" error={errors.listing_id}>
            <select {...field("listing_id")} className={inputClass}>
              <option value="">Geen</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        {!isBlock && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="agenda-status" label="Status">
              <select {...field("status")} className={inputClass}>
                <option value="pending">In afwachting</option>
                <option value="confirmed">Bevestigd</option>
                <option value="completed">Voltooid</option>
              </select>
            </Field>
            <Field id="agenda-price" label="Bedrag in € (optioneel)" error={errors.price}>
              <input {...field("price")} inputMode="decimal" className={inputClass} placeholder="bijv. 250" />
            </Field>
          </div>
        )}

        <Field id="agenda-note" label="Notitie (optioneel)" error={errors.note}>
          <textarea {...field("note")} rows={2} className={`${inputClass} h-auto py-3`} />
        </Field>

        <FormStatus state={saved ?? removed} />

        <div className="flex flex-wrap items-center gap-3">
          <button disabled={saving || removing} className="h-11 rounded-full bg-brand px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
            {saving ? "Bezig…" : "Opslaan"}
          </button>
          <button type="button" onClick={onClose} className="h-11 rounded-full border border-ink/15 px-6 text-sm font-semibold hover:border-brand hover:text-brand">
            Annuleren
          </button>
        </div>
      </form>

      {editing && (
        <form action={remove} className="mt-3">
          <input type="hidden" name="id" value={values.id} />
          <button disabled={saving || removing} className="text-sm font-semibold text-st-lost underline disabled:opacity-60">
            {removing ? "Verwijderen…" : "Verwijderen"}
          </button>
        </form>
      )}
    </div>
  );
}

export function AgendaDialog({ state, listings, onClose }: { state: DialogState | null; listings: AgendaListing[]; onClose: () => void }) {
  const ref = useDialog(state !== null);

  return (
    <dialog
      ref={ref}
      aria-labelledby="agenda-dialog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      {state?.mode === "view" && <ViewOnly event={state.event} onClose={onClose} />}
      {state && state.mode !== "view" && (
        <ItemForm key={state.mode === "edit" ? state.event.id : `${state.date}-${state.from}-${state.to}`} state={state} listings={listings} onClose={onClose} />
      )}
    </dialog>
  );
}

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return ref;
}
