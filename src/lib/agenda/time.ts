// Tijd en datum voor de agenda. Alles wordt in Nederlandse tijd (Europe/Amsterdam) getoond en ingevoerd;
// de database slaat tijdstippen op als UTC. Datums zijn tekst in de vorm JJJJ-MM-DD.

export const TZ = "Europe/Amsterdam";
export const DAY_MINUTES = 24 * 60;

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zonedParts(date: Date) {
  const p = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}

function offsetMs(date: Date) {
  const p = zonedParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Geeft de datum terug als `value` een bestaande datum JJJJ-MM-DD is, anders null. */
export function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? value : null;
}

/** Minuten sinds middernacht uit "HH:MM", of null. 24:00 is toegestaan als einde van de dag. */
export function parseTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[2]) < 60 && minutes <= DAY_MINUTES ? minutes : null;
}

export function formatTime(minutes: number) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Nederlandse klokTijd op `date` (JJJJ-MM-DD) naar een tijdstip. `minutes` mag 1440 of meer zijn (volgende dag). */
export function zonedToUtc(date: string, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  const first = naive - offsetMs(new Date(naive));
  return new Date(naive - offsetMs(new Date(first)));
}

/** Nederlandse datum en minuten sinds middernacht van een tijdstip. */
export function toLocal(value: Date | string): { date: string; minutes: number } {
  const p = zonedParts(typeof value === "string" ? new Date(value) : value);
  return { date: isoDate(p.year, p.month, p.day), minutes: p.hour * 60 + p.minute };
}

export const todayIso = () => toLocal(new Date()).date;

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const result = new Date(Date.UTC(y, m - 1, d + days));
  return isoDate(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate());
}

/** 0 = maandag, 6 = zondag. */
export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const startOfWeek = (date: string) => addDays(date, -weekdayOf(date));

export function weekDays(date: string) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Alle dagen die in een maandweergave staan: hele weken, van maandag tot en met zondag. */
export function monthGrid(date: string) {
  const [y, m] = date.split("-").map(Number);
  const first = isoDate(y, m, 1);
  const last = isoDate(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export type AgendaView = "dag" | "week" | "maand";

/** Zichtbare periode: `from` is de eerste dag, `to` de dag erna (exclusief). */
export function rangeFor(view: AgendaView, date: string): { from: string; to: string } {
  if (view === "dag") return { from: date, to: addDays(date, 1) };
  if (view === "week") {
    const from = startOfWeek(date);
    return { from, to: addDays(from, 7) };
  }
  const grid = monthGrid(date);
  return { from: grid[0], to: addDays(grid[grid.length - 1], 1) };
}

export function shiftDate(view: AgendaView, date: string, direction: -1 | 1) {
  if (view === "dag") return addDays(date, direction);
  if (view === "week") return addDays(date, 7 * direction);
  const [y, m] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + direction, 1));
  return isoDate(target.getUTCFullYear(), target.getUTCMonth() + 1, 1);
}

/**
 * Verdeelt overlappende afspraken over kolommen, zodat ze naast elkaar passen.
 * Geeft per afspraak de kolom en het aantal kolommen van zijn groep.
 */
export function layoutColumns(items: { start: number; end: number }[]): { column: number; columns: number }[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].start - items[b].start || items[b].end - items[a].end);
  const result: { column: number; columns: number }[] = items.map(() => ({ column: 0, columns: 1 }));

  let group: number[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    const columnEnds: number[] = [];
    for (const index of group) {
      let column = columnEnds.findIndex((end) => end <= items[index].start);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = items[index].end;
      result[index].column = column;
    }
    for (const index of group) result[index].columns = columnEnds.length;
  };

  for (const index of order) {
    if (items[index].start >= groupEnd && group.length) {
      flush();
      group = [];
    }
    group.push(index);
    groupEnd = Math.max(group.length === 1 ? -Infinity : groupEnd, items[index].end);
  }
  if (group.length) flush();
  return result;
}
