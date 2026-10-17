import { toLocal } from "@/lib/agenda/time";

// Opmaak voor de agenda (ook in de browser gebruikt).

const WEEKDAY_SHORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
export const weekdayShort = (weekday: number) => WEEKDAY_SHORT[weekday];

function utcDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", ...options }).format(utcDate(date));
}

/** 12500 wordt "125", 12550 wordt "125,50", null wordt "". */
export function formatPriceInput(cents: number | null | undefined) {
  if (cents == null) return "";
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest ? `${euros},${String(rest).padStart(2, "0")}` : String(euros);
}

/** € 852 of € 852,50, voor in de samenvatting. */
export function formatEuro(cents: number) {
  return `€${(cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function formatClock(iso: string) {
  const { minutes } = toLocal(iso);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "12 okt - 18 oktober 2026" voor een week, "zaterdag 17 oktober 2026" voor een dag, "oktober 2026" voor een maand. */
export function viewTitle(view: "dag" | "week" | "maand", date: string, weekStart: string, weekEnd: string) {
  if (view === "dag") return formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (view === "maand") return formatDate(date, { month: "long", year: "numeric" });
  return `${formatDate(weekStart, { day: "numeric", month: "short" }).replace(".", "")} - ${formatDate(weekEnd, { day: "numeric", month: "long", year: "numeric" })}`;
}
