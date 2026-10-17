import { describe, expect, it } from "vitest";
import {
  addDays,
  formatTime,
  layoutColumns,
  monthGrid,
  parseIsoDate,
  parseTime,
  rangeFor,
  shiftDate,
  startOfWeek,
  toLocal,
  weekDays,
  weekdayOf,
  zonedToUtc,
} from "@/lib/agenda/time";

describe("zonedToUtc en toLocal", () => {
  it("rekent winter- en zomertijd goed om", () => {
    expect(zonedToUtc("2026-01-15", 10 * 60).toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(zonedToUtc("2026-07-01", 10 * 60).toISOString()).toBe("2026-07-01T08:00:00.000Z");
  });

  it("volgt de overgang naar zomertijd (29 maart 2026)", () => {
    expect(zonedToUtc("2026-03-29", 60).toISOString()).toBe("2026-03-29T00:00:00.000Z"); // 01:00 CET
    expect(zonedToUtc("2026-03-29", 3 * 60).toISOString()).toBe("2026-03-29T01:00:00.000Z"); // 03:00 CEST
  });

  it("volgt de overgang naar wintertijd (25 oktober 2026)", () => {
    expect(zonedToUtc("2026-10-25", 60).toISOString()).toBe("2026-10-24T23:00:00.000Z"); // 01:00 CEST
    expect(zonedToUtc("2026-10-25", 4 * 60).toISOString()).toBe("2026-10-25T03:00:00.000Z"); // 04:00 CET
  });

  it("laat minuten boven 24 uur doorlopen naar de volgende dag", () => {
    expect(zonedToUtc("2026-01-15", 24 * 60).toISOString()).toBe(zonedToUtc("2026-01-16", 0).toISOString());
  });

  it("is het omgekeerde van toLocal", () => {
    for (const [date, minutes] of [["2026-01-15", 570], ["2026-07-01", 1230], ["2026-10-25", 600], ["2026-03-29", 600]] as const) {
      expect(toLocal(zonedToUtc(date, minutes))).toEqual({ date, minutes });
    }
  });

  it("toont een UTC-tijdstip rond middernacht op de juiste Nederlandse dag", () => {
    expect(toLocal("2026-07-01T22:30:00Z")).toEqual({ date: "2026-07-02", minutes: 30 });
    expect(toLocal("2026-01-01T23:30:00Z")).toEqual({ date: "2026-01-02", minutes: 30 });
  });
});

describe("datums", () => {
  it("rekent weken en maanden", () => {
    expect(weekdayOf("2026-10-12")).toBe(0);
    expect(weekdayOf("2026-10-18")).toBe(6);
    expect(startOfWeek("2026-10-17")).toBe("2026-10-12");
    expect(weekDays("2026-10-17")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("bouwt een maandweergave van hele weken", () => {
    const grid = monthGrid("2026-10-17");
    expect(grid[0]).toBe("2026-09-28");
    expect(grid.at(-1)).toBe("2026-11-01");
    expect(grid).toHaveLength(35);
  });

  it("bepaalt de zichtbare periode per weergave", () => {
    expect(rangeFor("dag", "2026-10-17")).toEqual({ from: "2026-10-17", to: "2026-10-18" });
    expect(rangeFor("week", "2026-10-17")).toEqual({ from: "2026-10-12", to: "2026-10-19" });
    expect(rangeFor("maand", "2026-10-17")).toEqual({ from: "2026-09-28", to: "2026-11-02" });
  });

  it("schuift per weergave vooruit en terug", () => {
    expect(shiftDate("dag", "2026-10-17", 1)).toBe("2026-10-18");
    expect(shiftDate("week", "2026-10-17", -1)).toBe("2026-10-10");
    expect(shiftDate("maand", "2026-10-17", 1)).toBe("2026-11-01");
    expect(shiftDate("maand", "2026-01-17", -1)).toBe("2025-12-01");
  });

  it("valideert datums en tijden", () => {
    expect(parseIsoDate("2026-02-29")).toBeNull();
    expect(parseIsoDate("2026-02-28")).toBe("2026-02-28");
    expect(parseIsoDate("12-10-2026")).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
    expect(parseTime("09:30")).toBe(570);
    expect(parseTime("9:05")).toBe(545);
    expect(parseTime("24:00")).toBe(1440);
    expect(parseTime("24:01")).toBeNull();
    expect(parseTime("10:60")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(formatTime(570)).toBe("09:30");
  });
});

describe("layoutColumns", () => {
  it("zet afspraken die niet overlappen in één kolom", () => {
    expect(layoutColumns([{ start: 0, end: 60 }, { start: 60, end: 120 }])).toEqual([
      { column: 0, columns: 1 },
      { column: 0, columns: 1 },
    ]);
  });

  it("zet overlappende afspraken naast elkaar", () => {
    const result = layoutColumns([{ start: 0, end: 120 }, { start: 60, end: 180 }, { start: 120, end: 150 }]);
    expect(result[0]).toEqual({ column: 0, columns: 2 });
    expect(result[1]).toEqual({ column: 1, columns: 2 });
    expect(result[2]).toEqual({ column: 0, columns: 2 });
  });

  it("verdeelt losse groepen apart", () => {
    const result = layoutColumns([{ start: 0, end: 60 }, { start: 30, end: 90 }, { start: 300, end: 360 }]);
    expect(result[2]).toEqual({ column: 0, columns: 1 });
    expect(result[0].columns).toBe(2);
  });
});
