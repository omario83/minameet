"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { setAvailability } from "@/lib/vendor-actions";

type Status = "free" | "option" | "booked";

const NEXT: Record<Status, Status> = { free: "option", option: "booked", booked: "free" };
const STYLE: Record<Status, string> = {
  free: "bg-mint/20 text-ink hover:bg-mint/40",
  option: "bg-st-option text-white",
  booked: "bg-st-lost text-white",
};
const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function AvailabilityCalendar({
  listingId,
  initial,
  locked,
  today,
}: {
  listingId: string;
  initial: { date: string; status: Status }[];
  locked: string[];
  today: string;
}) {
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);
  const [days, setDays] = useState<Record<string, Status>>(() => Object.fromEntries(initial.map((a) => [a.date, a.status])));
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const title = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  function shift(delta: number) {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
  }

  function toggle(date: string) {
    const previous = days[date] ?? "free";
    const next = NEXT[previous];
    setError(undefined);
    setDays((d) => ({ ...d, [date]: next }));
    startTransition(async () => {
      const result = await setAvailability(listingId, date, next);
      if (result.error) {
        setError(result.error);
        setDays((d) => ({ ...d, [date]: previous }));
      }
    });
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label="Vorige maand" className="rounded-full p-2 hover:bg-brand-soft">
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="font-display text-xl font-bold capitalize">{title}</h2>
        <button type="button" onClick={() => shift(1)} aria-label="Volgende maand" className="rounded-full p-2 hover:bg-brand-soft">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold uppercase text-ink/40">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = iso(year, month, i + 1);
          const status = days[date] ?? "free";
          const disabled = date < today || locked.includes(date);
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => toggle(date)}
              className={`aspect-square rounded-xl text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${STYLE[status]} ${locked.includes(date) ? "ring-2 ring-ink" : ""}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-st-lost">{error}</p>}

      <ul className="mt-5 flex flex-wrap gap-4 text-sm text-ink/70">
        <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-mint" /> Vrij</li>
        <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-st-option" /> Optie</li>
        <li className="flex items-center gap-2"><span className="size-3 rounded-full bg-st-lost" /> Geboekt</li>
        <li className="text-ink/50">Klik op een dag om de status te wisselen. Dagen met een zwarte rand zijn geboekt via MinaMeet.</li>
      </ul>
    </div>
  );
}
