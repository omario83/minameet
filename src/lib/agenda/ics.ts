import ICAL from "ical.js";
import { isoDate, zonedToUtc } from "@/lib/agenda/time";

export type IcsEvent = { uid: string; title: string; startsAt: Date; endsAt: Date; allDay: boolean };

const MAX_OCCURRENCES_PER_EVENT = 5000;

/** Tijd zonder tijdzone ("zwevend") lezen we als Nederlandse tijd. */
function toDate(time: ICAL.Time): Date {
  if (time.zone === ICAL.Timezone.localTimezone) return zonedToUtc(isoDate(time.year, time.month, time.day), time.hour * 60 + time.minute);
  return time.toJSDate();
}

function toRange(start: ICAL.Time, end: ICAL.Time | null): { startsAt: Date; endsAt: Date; allDay: boolean } {
  if (start.isDate) {
    const first = isoDate(start.year, start.month, start.day);
    const startsAt = zonedToUtc(first, 0);
    let endsAt = end ? zonedToUtc(isoDate(end.year, end.month, end.day), 0) : zonedToUtc(first, 24 * 60);
    if (endsAt <= startsAt) endsAt = zonedToUtc(first, 24 * 60);
    return { startsAt, endsAt, allDay: true };
  }
  const startsAt = toDate(start);
  let endsAt = end ? toDate(end) : new Date(startsAt.getTime() + 3_600_000);
  if (endsAt <= startsAt) endsAt = new Date(startsAt.getTime() + 3_600_000);
  return { startsAt, endsAt, allDay: false };
}

function isBusy(event: ICAL.Event) {
  const status = String(event.component.getFirstPropertyValue("status") ?? "").toUpperCase();
  const transparency = String(event.component.getFirstPropertyValue("transp") ?? "").toUpperCase();
  return status !== "CANCELLED" && transparency !== "TRANSPARENT";
}

/**
 * Leest een iCal-bestand en geeft de bezette momenten binnen `window`, inclusief herhalingen en uitzonderingen.
 * Geannuleerde en "vrij"-afspraken worden overgeslagen. Gooit een fout als het bestand niet te lezen is.
 */
export function parseIcs(text: string, window: { from: Date; to: Date }, max = 3000): IcsEvent[] {
  const calendar = new ICAL.Component(ICAL.parse(text));

  for (const zone of calendar.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(zone);

  try {
    const masters = new Map<string, ICAL.Event>();
    const exceptions: ICAL.Event[] = [];
    for (const component of calendar.getAllSubcomponents("vevent")) {
      const event = new ICAL.Event(component);
      if (!event.uid) continue;
      if (event.isRecurrenceException()) exceptions.push(event);
      else masters.set(event.uid, event);
    }
    for (const exception of exceptions) masters.get(exception.uid)?.relateException(exception);

    const result: IcsEvent[] = [];
    const add = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time | null, uid: string) => {
      if (!isBusy(item)) return;
      const range = toRange(start, end);
      if (range.endsAt <= window.from || range.startsAt >= window.to) return;
      result.push({ uid, title: (item.summary || "Bezet").trim().slice(0, 120) || "Bezet", ...range });
    };

    for (const [uid, event] of masters) {
      if (!event.isRecurring()) {
        add(event, event.startDate, event.endDate, uid);
      } else {
        const iterator = event.iterator();
        for (let count = 0; count < MAX_OCCURRENCES_PER_EVENT; count++) {
          const next = iterator.next();
          if (!next) break;
          const details = event.getOccurrenceDetails(next);
          if (toRange(details.startDate, details.endDate).startsAt >= window.to) break;
          add(details.item, details.startDate, details.endDate, `${uid}#${details.recurrenceId.toString()}`);
        }
      }
      if (result.length >= max) break;
    }

    return result.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).slice(0, max);
  } finally {
    ICAL.TimezoneService.reset();
  }
}
