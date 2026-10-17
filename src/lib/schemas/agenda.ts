import { z } from "zod";
import { DAY_MINUTES, addDays, formatTime, parseIsoDate, parseTime, zonedToUtc } from "@/lib/agenda/time";

// Dit bestand wordt ook in de browser gebruikt: geen server-only imports.

export const MAX_ALL_DAY_SPAN = 62;

const fields = z.object({
  id: z.string().default(""),
  kind: z.enum(["appointment", "block"], "Kies afspraak of blokkade"),
  title: z.string().trim().min(1, "Vul een titel in").max(120, "Gebruik maximaal 120 tekens"),
  customer_name: z.string().trim().max(120, "Gebruik maximaal 120 tekens").default(""),
  listing_id: z.string().default(""),
  status: z.enum(["pending", "confirmed", "completed"]).default("confirmed"),
  note: z.string().trim().max(1000, "Gebruik maximaal 1000 tekens").default(""),
  price: z.string().trim().default(""),
  all_day: z.string().optional(),
  date: z.string().default(""),
  end_date: z.string().default(""),
  start_time: z.string().default(""),
  end_time: z.string().default(""),
});

export type AgendaItemData = {
  id: string | null;
  kind: "appointment" | "block";
  status: "pending" | "confirmed" | "completed";
  title: string;
  customer_name: string | null;
  listing_id: string | null;
  note: string | null;
  price_cents: number | null;
  all_day: boolean;
  starts_at: string;
  ends_at: string;
};

export type ParseResult<T> = { success: true; data: T } | { success: false; errors: Record<string, string> };

/** "12,50" en "12.50" worden 1250 cent; leeg wordt null; ongeldig wordt undefined. */
export function parsePriceCents(value: string): number | null | undefined {
  const text = value.trim().replace(/^€\s*/, "").replace(",", ".");
  if (!text) return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return undefined;
  return Math.round(Number(text) * 100);
}

/** Valideert het agendaformulier en rekent datum en tijd (Nederlandse tijd) om naar tijdstippen. */
export function parseAgendaItem(input: Record<string, unknown>): ParseResult<AgendaItemData> {
  const base = fields.safeParse(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === "string" ? v : undefined])));
  const errors: Record<string, string> = {};
  if (!base.success) {
    for (const issue of base.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !(key in errors)) errors[key] = issue.message;
    }
  }
  const v = base.success ? base.data : null;

  const date = parseIsoDate(v?.date ?? input.date);
  if (!date) errors.date = "Kies een geldige datum";

  const listingId = v?.listing_id ?? "";
  if (listingId && !z.uuid().safeParse(listingId).success) errors.listing_id = "Ongeldig aanbod";

  const priceCents = v ? parsePriceCents(v.price) : null;
  if (priceCents === undefined) errors.price = "Vul een geldig bedrag in, bijvoorbeeld 125 of 125,50";

  const allDay = v?.all_day === "on";
  let startsAt: Date | undefined;
  let endsAt: Date | undefined;

  if (date && v) {
    if (allDay) {
      const endDate = v.end_date ? parseIsoDate(v.end_date) : date;
      if (!endDate) errors.end_date = "Kies een geldige einddatum";
      else if (endDate < date) errors.end_date = "De einddatum ligt voor de begindatum";
      else if (addDays(date, MAX_ALL_DAY_SPAN) < endDate) errors.end_date = `Maximaal ${MAX_ALL_DAY_SPAN} dagen achter elkaar`;
      else {
        startsAt = zonedToUtc(date, 0);
        endsAt = zonedToUtc(addDays(endDate, 1), 0);
      }
    } else {
      const start = parseTime(v.start_time);
      const end = parseTime(v.end_time);
      if (start === null || start >= DAY_MINUTES) errors.start_time = "Vul een begintijd in, bijvoorbeeld 09:00";
      if (end === null) errors.end_time = "Vul een eindtijd in, bijvoorbeeld 10:00";
      if (start !== null && end !== null && start < DAY_MINUTES && end <= start) {
        errors.end_time = `De eindtijd moet na ${formatTime(start)} liggen`;
      }
      if (!errors.start_time && !errors.end_time && start !== null && end !== null) {
        startsAt = zonedToUtc(date, start);
        endsAt = zonedToUtc(date, end);
      }
    }
  }

  if (Object.keys(errors).length || !v || !startsAt || !endsAt) return { success: false, errors };

  const isBlock = v.kind === "block";
  return {
    success: true,
    data: {
      id: v.id && z.uuid().safeParse(v.id).success ? v.id : null,
      kind: v.kind,
      status: isBlock ? "confirmed" : v.status,
      title: v.title,
      customer_name: isBlock ? null : v.customer_name || null,
      listing_id: listingId || null,
      note: v.note || null,
      price_cents: isBlock ? null : (priceCents ?? null),
      all_day: allDay,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    },
  };
}

// Openingstijden ------------------------------------------------------------

export type OpeningDay = { weekday: number; is_closed: boolean; opens: string; closes: string };

export const WEEKDAY_NAMES = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

/** Zonder ingestelde tijden: maandag t/m zaterdag 08:00 tot 18:00, zondag gesloten. */
export const DEFAULT_OPENING_HOURS: OpeningDay[] = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  is_closed: weekday === 6,
  opens: "08:00",
  closes: "18:00",
}));

export function parseOpeningHours(input: Record<string, unknown>): ParseResult<OpeningDay[]> {
  const errors: Record<string, string> = {};
  const days: OpeningDay[] = [];

  for (let weekday = 0; weekday < 7; weekday++) {
    const closed = input[`closed_${weekday}`] === "on";
    const opens = parseTime(input[`opens_${weekday}`]);
    const closes = parseTime(input[`closes_${weekday}`]);

    if (!closed) {
      if (opens === null || opens >= DAY_MINUTES) errors[`opens_${weekday}`] = "Vul een geldige openingstijd in";
      else if (closes === null) errors[`closes_${weekday}`] = "Vul een geldige sluitingstijd in";
      else if (closes <= opens) errors[`closes_${weekday}`] = "Sluiten moet na openen liggen";
    }
    days.push({
      weekday,
      is_closed: closed,
      opens: formatTime(opens !== null && opens < DAY_MINUTES ? opens : 480),
      closes: formatTime(closes !== null && closes > 0 ? closes : 1080),
    });
  }

  if (Object.keys(errors).length) return { success: false, errors };
  if (days.every((day) => day.is_closed)) return { success: false, errors: { closed_0: "Minimaal één dag moet open zijn" } };
  return { success: true, data: days };
}
