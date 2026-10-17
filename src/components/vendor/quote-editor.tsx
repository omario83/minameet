"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field, FormStatus, inputClass } from "@/components/form-ui";
import { saveQuote } from "@/lib/crm-actions";

type Row = { description: string; quantity: string; price: string };

export function QuoteEditor({
  requestId,
  quoteId,
  initialRows,
  validUntil,
  note,
}: {
  requestId: string;
  quoteId: string;
  initialRows: Row[];
  validUntil: string;
  note: string;
}) {
  const [state, action, pending] = useActionState(saveQuote, undefined);
  const [rows, setRows] = useState<Row[]>(initialRows.length ? initialRows : [{ description: "", quantity: "1", price: "" }]);

  const total = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.price) || 0), 0);
  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <form action={action} className="space-y-5 rounded-3xl bg-white p-6 shadow-sm">
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="quote_id" value={quoteId} />

      <div className="space-y-3">
        <div className="hidden grid-cols-[1fr_6rem_8rem_2.5rem] gap-3 text-xs font-semibold uppercase text-ink/40 sm:grid">
          <span>Omschrijving</span>
          <span>Aantal</span>
          <span>Prijs per stuk (€)</span>
          <span />
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-[1fr_6rem_8rem_2.5rem]">
            <input name="item_description" aria-label="Omschrijving" value={r.description} onChange={(e) => update(i, { description: e.target.value })} className={inputClass} />
            <input name="item_quantity" aria-label="Aantal" type="number" min="0.01" step="0.01" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className={inputClass} />
            <input name="item_price" aria-label="Prijs per stuk" type="number" min="0" step="0.01" value={r.price} onChange={(e) => update(i, { price: e.target.value })} className={inputClass} />
            <button type="button" aria-label="Regel verwijderen" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="flex h-12 items-center justify-center rounded-xl text-ink/40 hover:text-st-lost disabled:opacity-30">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setRows((rs) => [...rs, { description: "", quantity: "1", price: "" }])} className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
          <Plus className="size-4" /> Regel toevoegen
        </button>
      </div>

      <p className="flex justify-between border-t border-ink/10 pt-4 font-display text-xl font-bold">
        <span>Totaal</span>
        <span>€ {total.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="valid_until" label="Geldig tot">
          <input id="valid_until" name="valid_until" type="date" defaultValue={validUntil} className={inputClass} />
        </Field>
      </div>
      <Field id="note" label="Bericht aan de klant">
        <textarea id="note" name="note" rows={3} defaultValue={note} className={`${inputClass} h-auto py-3`} />
      </Field>

      <FormStatus state={state} />
      <div className="flex flex-wrap gap-3">
        <button name="intent" value="send" disabled={pending} className="h-12 rounded-full bg-st-sent px-8 font-semibold text-white hover:brightness-110 disabled:opacity-60">
          Offerte versturen
        </button>
        <button name="intent" value="save" disabled={pending} className="h-12 rounded-full border border-ink/15 px-8 font-semibold hover:border-brand hover:text-brand disabled:opacity-60">
          Concept opslaan
        </button>
      </div>
    </form>
  );
}
