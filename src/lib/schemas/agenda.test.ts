import { describe, expect, it } from "vitest";
import { DEFAULT_OPENING_HOURS, parseAgendaItem, parseOpeningHours, parsePriceCents } from "@/lib/schemas/agenda";

const timed = { kind: "appointment", title: "Gesprek", date: "2026-07-01", start_time: "10:00", end_time: "11:30" };
const parse = (overrides: Record<string, string> = {}) => parseAgendaItem({ ...timed, ...overrides });

describe("parseAgendaItem", () => {
  it("rekent een afspraak in Nederlandse tijd om naar UTC", () => {
    const result = parse({ customer_name: " Omar ", price: "125,50", status: "pending" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      kind: "appointment",
      status: "pending",
      title: "Gesprek",
      customer_name: "Omar",
      price_cents: 12550,
      all_day: false,
      starts_at: "2026-07-01T08:00:00.000Z",
      ends_at: "2026-07-01T09:30:00.000Z",
      listing_id: null,
      id: null,
    });
  });

  it("gebruikt wintertijd in januari", () => {
    const result = parse({ date: "2026-01-15" });
    expect(result.success && result.data.starts_at).toBe("2026-01-15T09:00:00.000Z");
  });

  it("maakt van een hele dag een bereik van middernacht tot middernacht", () => {
    const result = parseAgendaItem({ kind: "block", title: "Vakantie", date: "2026-07-01", end_date: "2026-07-03", all_day: "on" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.all_day).toBe(true);
    expect(result.data.starts_at).toBe("2026-06-30T22:00:00.000Z");
    expect(result.data.ends_at).toBe("2026-07-03T22:00:00.000Z");
  });

  it("negeert prijs, klant en status bij een blokkade", () => {
    const result = parseAgendaItem({ ...timed, kind: "block", price: "99", customer_name: "X", status: "completed" });
    expect(result.success && result.data).toMatchObject({ price_cents: null, customer_name: null, status: "confirmed" });
  });

  it("accepteert eindtijd 24:00 voor een afspraak tot middernacht", () => {
    const result = parse({ start_time: "22:00", end_time: "24:00" });
    expect(result.success && result.data.ends_at).toBe("2026-07-01T22:00:00.000Z");
  });

  it.each([
    [{ title: "" }, "title"],
    [{ title: "x".repeat(121) }, "title"],
    [{ date: "2026-02-30" }, "date"],
    [{ date: "" }, "date"],
    [{ start_time: "25:00" }, "start_time"],
    [{ start_time: "" }, "start_time"],
    [{ end_time: "09:00" }, "end_time"],
    [{ end_time: "10:00" }, "end_time"],
    [{ price: "abc" }, "price"],
    [{ price: "-5" }, "price"],
    [{ listing_id: "geen-uuid" }, "listing_id"],
    [{ kind: "andere" }, "kind"],
  ])("weigert %j (veld %s)", (overrides, field) => {
    const result = parse(overrides as Record<string, string>);
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(result.errors)).toContain(field);
  });

  it("weigert een einddatum voor de begindatum en een te lange periode bij een hele dag", () => {
    const allDay = { kind: "block", title: "Dicht", date: "2026-07-10", all_day: "on" };
    const before = parseAgendaItem({ ...allDay, end_date: "2026-07-01" });
    expect(!before.success && before.errors.end_date).toMatch(/voor de begindatum/);
    const tooLong = parseAgendaItem({ ...allDay, end_date: "2027-07-10" });
    expect(!tooLong.success && tooLong.errors.end_date).toMatch(/Maximaal 62 dagen/);
  });

  it("neemt een geldig id en aanbod over", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const result = parse({ id, listing_id: id });
    expect(result.success && [result.data.id, result.data.listing_id]).toEqual([id, id]);
  });
});

describe("parsePriceCents", () => {
  it("leest bedragen met komma of punt", () => {
    expect(parsePriceCents("125")).toBe(12500);
    expect(parsePriceCents("125,5")).toBe(12550);
    expect(parsePriceCents("€ 9.99")).toBe(999);
    expect(parsePriceCents("")).toBeNull();
    expect(parsePriceCents("1,234")).toBeUndefined();
    expect(parsePriceCents("1e3")).toBeUndefined();
  });
});

describe("parseOpeningHours", () => {
  const open = (weekday: number) => ({ [`opens_${weekday}`]: "09:00", [`closes_${weekday}`]: "17:00" });

  it("leest de ingevulde dagen", () => {
    const input = { ...open(0), ...open(1), closed_2: "on", ...open(3), ...open(4), ...open(5), closed_6: "on" };
    const result = parseOpeningHours(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0]).toEqual({ weekday: 0, is_closed: false, opens: "09:00", closes: "17:00" });
    expect(result.data[2].is_closed).toBe(true);
  });

  it("weigert sluiten voor openen en ongeldige tijden", () => {
    const result = parseOpeningHours({ ...open(0), opens_1: "18:00", closes_1: "09:00", opens_2: "xx", closes_2: "17:00" });
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(result.errors)).toEqual(expect.arrayContaining(["closes_1", "opens_2"]));
  });

  it("eist minimaal één open dag", () => {
    const input = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`closed_${i}`, "on"]));
    expect(parseOpeningHours(input).success).toBe(false);
  });

  it("heeft standaardtijden met zondag gesloten", () => {
    expect(DEFAULT_OPENING_HOURS).toHaveLength(7);
    expect(DEFAULT_OPENING_HOURS[6].is_closed).toBe(true);
    expect(DEFAULT_OPENING_HOURS[0]).toMatchObject({ opens: "08:00", closes: "18:00" });
  });
});
