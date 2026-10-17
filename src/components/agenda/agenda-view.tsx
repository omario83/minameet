"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { AgendaDialog, type DialogState } from "@/components/agenda/agenda-dialog";
import { syncCalendarFeed } from "@/lib/agenda-actions";
import { formatClock, formatDate, formatEuro, viewTitle, weekdayShort } from "@/lib/agenda/format";
import {
  addDays,
  layoutColumns,
  monthGrid,
  parseTime,
  rangeFor,
  shiftDate,
  toLocal,
  weekDays,
  weekdayOf,
  zonedToUtc,
  type AgendaView as ViewMode,
} from "@/lib/agenda/time";
import type { AgendaEvent, AgendaListing, FeedInfo } from "@/lib/agenda/types";
import type { OpeningDay } from "@/lib/schemas/agenda";

const SLOT_MIN = 30;
const SLOT_PX = 28;
const PX_PER_MIN = SLOT_PX / SLOT_MIN;
const LABEL_COLUMN = 56;

const HATCH_BLOCKED = "repeating-linear-gradient(135deg, rgba(201,151,0,0.3) 0 6px, transparent 6px 12px)";
const HATCH_CLOSED = "repeating-linear-gradient(135deg, rgba(30,22,17,0.09) 0 6px, transparent 6px 12px)";

type Props = {
  view: ViewMode;
  date: string;
  today: string;
  nowMinutes: number;
  events: AgendaEvent[];
  listings: AgendaListing[];
  opening: OpeningDay[];
  listingFilter: string | null;
  feed: FeedInfo | null;
  feedStale: boolean;
};

type Pick = { date: string; from: number; to: number };

const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

function dayBounds(date: string) {
  return { start: zonedToUtc(date, 0).getTime(), end: zonedToUtc(addDays(date, 1), 0).getTime() };
}

function eventsOnDay(events: AgendaEvent[], date: string) {
  const { start, end } = dayBounds(date);
  return events.filter((e) => new Date(e.startsAt).getTime() < end && new Date(e.endsAt).getTime() > start);
}

/** Begin en einde (minuten sinds middernacht) van een afspraak op één dag. */
function minutesOnDay(event: AgendaEvent, date: string) {
  const { start, end } = dayBounds(date);
  const s = new Date(Math.max(new Date(event.startsAt).getTime(), start));
  const e = new Date(Math.min(new Date(event.endsAt).getTime(), end));
  const from = toLocal(s);
  const to = toLocal(e);
  return { from: from.date === date ? from.minutes : 0, to: to.date === date ? to.minutes : 1440 };
}

function eventLook(event: AgendaEvent): { className: string; style?: React.CSSProperties } {
  if (event.status === "blocked") return { className: "border border-st-todo/60 text-ink", style: { backgroundColor: "#fff8e1", backgroundImage: HATCH_BLOCKED } };
  if (event.status === "external") return { className: "border border-ink/10 bg-sand text-ink" };
  if (event.status === "pending") return { className: "border-2 border-dashed border-st-todo bg-white text-ink" };
  if (event.status === "completed") return { className: "bg-st-won text-white" };
  if (event.kind === "booking") return { className: "bg-forest text-white" };
  if (event.kind === "availability") return { className: "bg-st-option text-white" };
  return { className: "bg-st-open text-white" };
}

export function AgendaScreen(props: Props) {
  const { view, date, today, nowMinutes, events, listings, opening, listingFilter, feed, feedStale } = props;
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState | null>(null);

  // Een gekoppelde kalender die een tijd niet is bijgewerkt, wordt bij het openen van de agenda ververst.
  useEffect(() => {
    if (!feedStale) return;
    let cancelled = false;
    syncCalendarFeed().then(() => {
      if (!cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [feedStale, router]);

  const href = (patch: { weergave?: ViewMode; datum?: string; aanbod?: string | null }) => {
    const query = new URLSearchParams({ weergave: patch.weergave ?? view, datum: patch.datum ?? date });
    const filter = patch.aanbod === undefined ? listingFilter : patch.aanbod;
    if (filter) query.set("aanbod", filter);
    return `/leverancier/agenda?${query}`;
  };

  const visible = listingFilter ? events.filter((e) => !e.listingId || e.listingId === listingFilter) : events;
  const range = rangeFor(view, date);
  const days = view === "dag" ? [date] : view === "week" ? weekDays(date) : monthGrid(date);
  const weekStart = weekDays(date)[0];

  const planned = visible.filter((e) => e.kind === "appointment" || e.kind === "booking");
  const expected = planned.reduce((sum, e) => sum + (e.priceCents ?? 0), 0);
  const periodLabel = view === "dag" ? (date === today ? "vandaag" : "op deze dag") : view === "week" ? "deze week" : "deze maand";
  const listingTitle = listings.find((l) => l.id === listingFilter)?.title;

  // Zichtbare uren: de openingstijden van alle open dagen, uitgebreid met afspraken buiten die tijden.
  const openDays = opening.filter((d) => !d.is_closed);
  let startMin = Math.min(...openDays.map((d) => parseTime(d.opens) ?? 480), 480);
  let endMin = Math.max(...openDays.map((d) => parseTime(d.closes) ?? 1080), 1080);
  for (const day of days) {
    for (const e of eventsOnDay(visible, day).filter((x) => !x.allDay)) {
      const m = minutesOnDay(e, day);
      startMin = Math.min(startMin, m.from);
      endMin = Math.max(endMin, m.to);
    }
  }
  startMin = Math.max(0, Math.floor(startMin / 60) * 60);
  endMin = Math.min(1440, Math.ceil(endMin / 60) * 60);

  const openNew = (pick?: Pick, allDay = false) =>
    setDialog({
      mode: "new",
      date: pick?.date ?? (days.includes(today) ? today : days[0]),
      from: pick?.from ?? 9 * 60,
      to: pick?.to ?? 10 * 60,
      allDay,
    });
  const openEvent = (event: AgendaEvent) => setDialog({ mode: event.editable ? "edit" : "view", event });

  const tabs: { key: ViewMode; label: string }[] = [
    { key: "dag", label: "Dag" },
    { key: "week", label: "Week" },
    { key: "maand", label: "Maand" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/60">Klik op een tijdvak of sleep over meerdere vakken om een afspraak in te plannen of tijd te blokkeren.</p>

      <div className="rounded-3xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
        <nav aria-label="Weergave" className="grid grid-cols-3 gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={href({ weergave: tab.key })}
              aria-current={tab.key === view ? "page" : undefined}
              className={`flex h-11 items-center justify-center rounded-xl text-sm font-semibold ${tab.key === view ? "bg-brand text-white" : "bg-brand-soft text-brand hover:brightness-95"}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-ink/10 px-4 py-3 text-sm">
          <Link
            href={href({ aanbod: null })}
            className={`rounded-full px-4 py-1.5 font-semibold ${listingFilter ? "bg-sand text-ink/70" : "bg-ink text-white"}`}
          >
            Alle afspraken · {planned.length}
          </Link>
          {listings.length > 0 && (
            <label className="flex items-center gap-2">
              <span className="sr-only">Filter op aanbod</span>
              <select
                value={listingFilter ?? ""}
                onChange={(e) => router.push(href({ aanbod: e.target.value || null }))}
                className="h-9 rounded-full border border-ink/15 bg-white px-3 text-sm font-medium"
              >
                <option value="">Alle aanbod</option>
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/70">
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-st-open" /> Bevestigd</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border-2 border-dashed border-st-todo" /> In afwachting</li>
            <li className="flex items-center gap-1.5"><Check aria-hidden className="size-3.5 text-st-won" /> Voltooid</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-st-todo/60" style={{ backgroundImage: HATCH_BLOCKED }} /> Geblokkeerd</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-ink/10" style={{ backgroundImage: HATCH_CLOSED }} /> Gesloten</li>
            <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-sand" /> Externe kalender</li>
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link href={href({ datum: today })} className="inline-flex h-10 items-center rounded-full border border-ink/15 px-5 text-sm font-semibold hover:border-brand hover:text-brand">
            Vandaag
          </Link>
          <Link href={href({ datum: shiftDate(view, date, -1) })} aria-label="Vorige" className="inline-flex size-10 items-center justify-center rounded-full border border-ink/15 hover:border-brand hover:text-brand">
            <ChevronLeft aria-hidden className="size-4" />
          </Link>
          <Link href={href({ datum: shiftDate(view, date, 1) })} aria-label="Volgende" className="inline-flex size-10 items-center justify-center rounded-full border border-ink/15 hover:border-brand hover:text-brand">
            <ChevronRight aria-hidden className="size-4" />
          </Link>
          <h2 className="flex-1 text-center font-display text-lg font-bold capitalize sm:text-xl">{viewTitle(view, date, weekStart, addDays(weekStart, 6))}</h2>
          <input
            type="date"
            aria-label="Ga naar datum"
            value={date}
            onChange={(e) => e.target.value && router.push(href({ datum: e.target.value }))}
            className="h-10 rounded-xl border border-ink/15 px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => openNew()}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white hover:brightness-110"
          >
            <Plus aria-hidden className="size-4" /> Afspraak toevoegen
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-ink/10 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-3xl bg-cream px-5 py-3 text-sm">
          <div>
            <p className="font-semibold">Agenda · {listingTitle ?? "Alle afspraken"}</p>
            <p className="text-xs text-ink/60">
              Hele agenda · {planned.length} {planned.length === 1 ? "afspraak" : "afspraken"} {periodLabel}
              {expected > 0 && ` · verwacht ${formatEuro(expected)}`}
            </p>
          </div>
          {feed && (
            <p className="flex items-center gap-2 text-xs text-ink/60">
              Gekoppeld: {feed.host}
              {feed.lastSyncedAt && ` · bijgewerkt ${formatClock(feed.lastSyncedAt)}`}
              {feed.lastError && <span className="font-medium text-st-lost"> · {feed.lastError}</span>}
              <button
                type="button"
                onClick={() => syncCalendarFeed().then(() => router.refresh())}
                aria-label="Gekoppelde kalender bijwerken"
                className="rounded-full p-1.5 hover:bg-white"
              >
                <RefreshCw aria-hidden className="size-4" />
              </button>
            </p>
          )}
        </div>

        {view === "maand" ? (
          <MonthGrid days={days} date={date} today={today} opening={opening} events={visible} href={href} onOpen={openEvent} />
        ) : (
          <TimeGrid
            days={days}
            today={today}
            nowMinutes={nowMinutes}
            opening={opening}
            events={visible}
            startMin={startMin}
            endMin={endMin}
            onPick={(pick) => openNew(pick)}
            onOpen={openEvent}
            onAllDay={(day) => openNew({ date: day, from: 9 * 60, to: 10 * 60 }, true)}
          />
        )}
      </div>

      <p className="text-xs text-ink/50">
        Periode: {formatDate(range.from, { day: "numeric", month: "short" })} t/m {formatDate(addDays(range.to, -1), { day: "numeric", month: "short", year: "numeric" })}. Tijden zijn Nederlandse tijd.
      </p>

      <AgendaDialog state={dialog} listings={listings} onClose={() => setDialog(null)} />
    </div>
  );
}

function EventCard({ event, className = "", style, onOpen, compact = false }: { event: AgendaEvent; className?: string; style?: React.CSSProperties; onOpen: (e: AgendaEvent) => void; compact?: boolean }) {
  const look = eventLook(event);
  return (
    <button
      type="button"
      data-event
      onClick={() => onOpen(event)}
      title={event.title}
      className={`overflow-hidden rounded-lg px-2 py-1 text-left text-xs leading-tight shadow-sm outline-offset-2 hover:brightness-95 ${look.className} ${className}`}
      style={{ ...look.style, ...style }}
    >
      <span className="flex items-center gap-1 font-semibold">
        {event.status === "completed" && <Check aria-hidden className="size-3 shrink-0" />}
        <span className="truncate">{event.title}</span>
      </span>
      {!compact && !event.allDay && (
        <span className="block truncate opacity-90">
          {formatClock(event.startsAt)} - {formatClock(event.endsAt)}
        </span>
      )}
      {!compact && event.subtitle && <span className="block truncate opacity-80">{event.subtitle}</span>}
    </button>
  );
}

function TimeGrid(props: {
  days: string[];
  today: string;
  nowMinutes: number;
  opening: OpeningDay[];
  events: AgendaEvent[];
  startMin: number;
  endMin: number;
  onPick: (pick: Pick) => void;
  onOpen: (event: AgendaEvent) => void;
  onAllDay: (date: string) => void;
}) {
  const { days, today, nowMinutes, opening, events, startMin, endMin, onPick, onOpen, onAllDay } = props;
  const height = (endMin - startMin) * PX_PER_MIN;
  const columns = `${LABEL_COLUMN}px repeat(${days.length}, minmax(0, 1fr))`;
  const hours = Array.from({ length: (endMin - startMin) / 60 }, (_, i) => startMin / 60 + i);
  const allDayByDay = days.map((day) => eventsOnDay(events, day).filter((e) => e.allDay));
  const hasAllDay = allDayByDay.some((list) => list.length);

  return (
    <div className="overflow-x-auto">
      <div className={days.length > 1 ? "min-w-[760px]" : ""}>
        <div className="grid border-b border-ink/10" style={{ gridTemplateColumns: columns }}>
          <div />
          {days.map((day) => {
            const closed = opening[weekdayOf(day)].is_closed;
            const count = eventsOnDay(events, day).length;
            return (
              <div key={day} className={`border-l border-ink/10 px-2 py-2 text-center ${day === today ? "bg-brand-soft" : ""}`}>
                <p className={`text-sm font-semibold ${day === today ? "text-brand" : ""}`}>
                  {weekdayShort(weekdayOf(day))} {Number(day.slice(8))}
                </p>
                <p className="text-xs text-ink/50">{closed ? "Gesloten" : count || "\u00a0"}</p>
              </div>
            );
          })}
        </div>

        {hasAllDay && (
          <div className="grid border-b border-ink/10" style={{ gridTemplateColumns: columns }}>
            <div className="px-2 py-2 text-right text-[11px] text-ink/50">hele dag</div>
            {days.map((day, i) => (
              <div key={day} className="min-w-0 space-y-1 border-l border-ink/10 p-1">
                {allDayByDay[i].map((e) => (
                  <EventCard key={`${e.id}-${day}`} event={e} compact onOpen={onOpen} className="block w-full" />
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="max-h-[68vh] overflow-y-auto">
          <div className="relative grid" style={{ gridTemplateColumns: columns, height }}>
            <div className="relative">
              {hours.flatMap((hour) => [
                <span key={hour} className="absolute right-2 text-xs font-semibold text-ink/70" style={{ top: (hour * 60 - startMin) * PX_PER_MIN - 8 }}>
                  {hhmm(hour * 60)}
                </span>,
                <span key={`${hour}.5`} className="absolute right-2 text-[10px] text-ink/40" style={{ top: (hour * 60 + 30 - startMin) * PX_PER_MIN - 7 }}>
                  {hhmm(hour * 60 + 30)}
                </span>,
              ])}
            </div>
            {days.map((day) => (
              <DayColumn
                key={day}
                day={day}
                isToday={day === today}
                nowMinutes={nowMinutes}
                closed={opening[weekdayOf(day)].is_closed}
                opens={parseTime(opening[weekdayOf(day)].opens) ?? 480}
                closes={parseTime(opening[weekdayOf(day)].closes) ?? 1080}
                startMin={startMin}
                endMin={endMin}
                events={eventsOnDay(events, day).filter((e) => !e.allDay)}
                onPick={onPick}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
        <div className="border-t border-ink/10 px-4 py-2 text-right">
          <button type="button" onClick={() => onAllDay(days.includes(today) ? today : days[0])} className="text-xs font-semibold text-brand underline">
            Hele dag blokkeren of plannen
          </button>
        </div>
      </div>
    </div>
  );
}

function DayColumn(props: {
  day: string;
  isToday: boolean;
  nowMinutes: number;
  closed: boolean;
  opens: number;
  closes: number;
  startMin: number;
  endMin: number;
  events: AgendaEvent[];
  onPick: (pick: Pick) => void;
  onOpen: (event: AgendaEvent) => void;
}) {
  const { day, isToday, nowMinutes, closed, opens, closes, startMin, endMin, events, onPick, onOpen } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const slots = (endMin - startMin) / SLOT_MIN;

  const slotAt = (clientY: number) => {
    const top = ref.current?.getBoundingClientRect().top ?? 0;
    return Math.min(Math.max(Math.floor((clientY - top) / SLOT_PX), 0), slots - 1);
  };

  const layout = layoutColumns(events.map((e) => minutesOnDay(e, day)).map((m) => ({ start: m.from, end: m.to })));
  const selection = drag ? { from: Math.min(drag.a, drag.b), to: Math.max(drag.a, drag.b) } : null;

  return (
    <div
      ref={ref}
      data-day={day}
      role="presentation"
      className={`relative border-l border-ink/10 ${closed ? "cursor-not-allowed" : "cursor-crosshair"} ${isToday && !closed ? "bg-brand-soft/30" : ""}`}
      style={{
        touchAction: "pan-y",
        backgroundImage: closed
          ? HATCH_CLOSED
          : `linear-gradient(to bottom, rgba(30,22,17,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(30,22,17,0.05) 1px, transparent 1px)`,
        backgroundSize: closed ? undefined : `100% ${SLOT_PX * 2}px, 100% ${SLOT_PX}px`,
      }}
      onPointerDown={(e) => {
        if (closed || e.button !== 0 || (e.target as HTMLElement).closest("[data-event]")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const slot = slotAt(e.clientY);
        setDrag({ a: slot, b: slot });
      }}
      onPointerMove={(e) => {
        if (drag) setDrag({ ...drag, b: slotAt(e.clientY) });
      }}
      onPointerUp={(e) => {
        if (!drag) return;
        const slot = slotAt(e.clientY);
        const lo = Math.min(drag.a, slot);
        const hi = Math.max(drag.a, slot);
        setDrag(null);
        onPick({ date: day, from: startMin + lo * SLOT_MIN, to: startMin + (hi + 1) * SLOT_MIN });
      }}
      onPointerCancel={() => setDrag(null)}
    >
      {!closed && opens > startMin && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bg-ink/[0.05]" style={{ height: (opens - startMin) * PX_PER_MIN }} />}
      {!closed && closes < endMin && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/[0.05]" style={{ height: (endMin - closes) * PX_PER_MIN }} />
      )}

      {selection && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0.5 z-10 rounded-lg border-2 border-brand bg-brand/15"
          style={{ top: selection.from * SLOT_PX, height: (selection.to - selection.from + 1) * SLOT_PX }}
        />
      )}

      {events.map((event, i) => {
        const m = minutesOnDay(event, day);
        const { column, columns } = layout[i];
        return (
          <EventCard
            key={event.id}
            event={event}
            onOpen={onOpen}
            className="absolute z-[5]"
            style={{
              top: (m.from - startMin) * PX_PER_MIN,
              height: Math.max((m.to - m.from) * PX_PER_MIN - 2, 22),
              left: `calc(${(column / columns) * 100}% + 2px)`,
              width: `calc(${100 / columns}% - 4px)`,
            }}
          />
        );
      })}

      {isToday && nowMinutes >= startMin && nowMinutes <= endMin && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-st-lost" style={{ top: (nowMinutes - startMin) * PX_PER_MIN }}>
          <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-st-lost" />
        </div>
      )}
    </div>
  );
}

function MonthGrid(props: {
  days: string[];
  date: string;
  today: string;
  opening: OpeningDay[];
  events: AgendaEvent[];
  href: (patch: { weergave?: ViewMode; datum?: string }) => string;
  onOpen: (event: AgendaEvent) => void;
}) {
  const { days, date, today, opening, events, href, onOpen } = props;
  const month = date.slice(0, 7);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-7 border-b border-ink/10 text-center text-xs font-semibold uppercase text-ink/50">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="py-2">
              {weekdayShort(i)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const closed = opening[weekdayOf(day)].is_closed;
            const list = eventsOnDay(events, day);
            return (
              <div
                key={day}
                className={`min-h-28 border-b border-l border-ink/10 p-1.5 ${day.startsWith(month) ? "" : "opacity-50"} ${day === today ? "bg-brand-soft/40" : ""}`}
                style={closed ? { backgroundImage: HATCH_CLOSED } : undefined}
              >
                <Link href={href({ weergave: "dag", datum: day })} className={`inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold hover:bg-brand-soft ${day === today ? "bg-brand text-white hover:bg-brand" : ""}`}>
                  {Number(day.slice(8))}
                </Link>
                <div className="mt-1 space-y-1">
                  {list.slice(0, 3).map((e) => (
                    <EventCard key={`${e.id}-${day}`} event={e} compact onOpen={onOpen} className="block w-full" />
                  ))}
                  {list.length > 3 && (
                    <Link href={href({ weergave: "dag", datum: day })} className="block px-1 text-xs font-semibold text-brand">
                      +{list.length - 3} meer
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
