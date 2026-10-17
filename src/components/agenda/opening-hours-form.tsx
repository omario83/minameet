"use client";

import { useActionState, useState } from "react";
import { Field, FormStatus, inputClass } from "@/components/form-ui";
import { saveOpeningHours } from "@/lib/agenda-actions";
import { WEEKDAY_NAMES, type OpeningDay } from "@/lib/schemas/agenda";

export function OpeningHoursForm({ initial, setup = false }: { initial: OpeningDay[]; setup?: boolean }) {
  const [days, setDays] = useState(initial);
  const [state, action, pending] = useActionState(saveOpeningHours, undefined);
  const errors = state?.fieldErrors ?? {};

  const update = (weekday: number, patch: Partial<OpeningDay>) =>
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));

  return (
    <form action={action} className="space-y-4">
      {setup && <input type="hidden" name="continue" value="setup" />}
      <ul className="divide-y divide-ink/5">
        {days.map((day) => (
          <li key={day.weekday} className="grid grid-cols-[7rem_1fr] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[8rem_auto_1fr]">
            <span className="font-medium">{WEEKDAY_NAMES[day.weekday]}</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`closed_${day.weekday}`}
                checked={day.is_closed}
                onChange={(e) => update(day.weekday, { is_closed: e.target.checked })}
                className="size-5 accent-brand"
              />
              Gesloten
            </label>
            <div className="col-span-2 flex flex-wrap items-start gap-3 sm:col-span-1">
              {!day.is_closed && (
                <>
                  <Field id={`opens_${day.weekday}`} label="Open" error={errors[`opens_${day.weekday}`]}>
                    <input
                      id={`opens_${day.weekday}`}
                      name={`opens_${day.weekday}`}
                      type="time"
                      value={day.opens}
                      onChange={(e) => update(day.weekday, { opens: e.target.value })}
                      aria-invalid={errors[`opens_${day.weekday}`] ? true : undefined}
                      className={`${inputClass} w-32`}
                    />
                  </Field>
                  <Field id={`closes_${day.weekday}`} label="Dicht" error={errors[`closes_${day.weekday}`]}>
                    <input
                      id={`closes_${day.weekday}`}
                      name={`closes_${day.weekday}`}
                      type="time"
                      value={day.closes}
                      onChange={(e) => update(day.weekday, { closes: e.target.value })}
                      aria-invalid={errors[`closes_${day.weekday}`] ? true : undefined}
                      className={`${inputClass} w-32`}
                    />
                  </Field>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {errors.closed_0 && (
        <p role="alert" className="text-sm font-medium text-st-lost">
          {errors.closed_0}
        </p>
      )}
      <FormStatus state={state} />
      <button disabled={pending} className="h-12 rounded-full bg-brand px-8 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? "Bezig…" : setup ? "Opslaan en verder" : "Openingstijden opslaan"}
      </button>
    </form>
  );
}
